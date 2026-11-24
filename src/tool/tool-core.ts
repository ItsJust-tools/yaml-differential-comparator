import yaml from 'js-yaml';

/** A single difference entry between the two parsed documents. */
export interface DiffEntry {
  /** Dot-notation path from the document root (e.g. services.web.image). */
  path: string;
  /** Kind of difference. */
  type: 'added' | 'removed' | 'changed';
  /** Old (left) value formatted for display; present for removed/changed. */
  old?: string;
  /** New (right) value formatted for display; present for added/changed. */
  new?: string;
  /** 1-based line in the left document when known. */
  leftLine?: number;
  /** 1-based line in the right document when known. */
  rightLine?: number;
  /** Nested child differences (for container nodes). */
  children?: DiffEntry[];
}

export interface ParseOk {
  ok: true;
  data: unknown;
}

export interface ParseError {
  ok: false;
  line: number;
  message: string;
}

export type ParseOutcome = ParseOk | ParseError;

export type SortKey = 'path' | 'type' | 'old' | 'new';

/** State persisted by the tool shell. */
export interface ToolState {
  leftYaml: string;
  rightYaml: string;
  ignoreListOrder: boolean;
  arraysAsMultisets: boolean;
  /** Line-accurate parse error for the left document, empty when valid. */
  leftError: string;
  /** Line-accurate parse error for the right document, empty when valid. */
  rightError: string;
  summary: string;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  leftOk: boolean;
  rightOk: boolean;
  hasDiff: boolean;
  sortKey: SortKey;
  sortDesc: boolean;
  expandedPaths: string[];
  diff: DiffEntry[];
}

const DEFAULT_LEFT_YAML = `name: web-app
version: 1.2.0
services:
  web:
    image: nginx:1.25
    replicas: 2
    ports:
      - 80
      - 443
  cache:
    image: redis:7
`;

const DEFAULT_RIGHT_YAML = `name: web-app
version: 1.3.0
services:
  web:
    image: nginx:1.27
    replicas: 3
    ports:
      - 80
      - 443
    healthcheck: /health
  worker:
    image: worker:2
`;

export const DEFAULT_STATE: ToolState = {
  leftYaml: DEFAULT_LEFT_YAML,
  rightYaml: DEFAULT_RIGHT_YAML,
  ignoreListOrder: false,
  arraysAsMultisets: false,
  leftError: '',
  rightError: '',
  summary: '',
  addedCount: 0,
  removedCount: 0,
  changedCount: 0,
  leftOk: true,
  rightOk: true,
  hasDiff: false,
  sortKey: 'path',
  sortDesc: false,
  expandedPaths: [],
  diff: [],
};

/** Parse YAML text; returns data or a line-accurate error. */
export function parseYaml(text: string): ParseOutcome {
  try {
    return { ok: true, data: yaml.load(text) };
  } catch (error) {
    const err = error as { mark?: { line?: number }; message?: string };
    const line = typeof err.mark?.line === 'number' ? err.mark.line + 1 : 1;
    const message =
      typeof err.message === 'string' && err.message.length > 0
        ? (err.message.split('\n')[0] ?? 'Invalid YAML')
        : 'Invalid YAML';
    return { ok: false, line, message };
  }
}

/** Format a scalar value for display in the diff tree. */
export function formatValue(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    try {
      return yaml.dump(value).trimEnd();
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export interface DiffOptions {
  ignoreListOrder: boolean;
  arraysAsMultisets: boolean;
}

function scalarEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // js-yaml parses unquoted date-like scalars into Date objects; compare loosely.
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return false;
}

interface IndexedItem {
  data: unknown;
  path: string;
}

/** Best-effort multiset matching of two arrays; returns unmatched pairs or null when shapes differ. */
function matchMultiset(
  left: unknown[],
  right: unknown[],
  basePath: string,
  options: DiffOptions
): {
  pairs: Array<{ leftIndex: number; rightIndex: number }>;
  leftOnly: number[];
  rightOnly: number[];
} {
  const leftItems: IndexedItem[] = left.map((data) => ({ data, path: basePath }));
  const rightItems: IndexedItem[] = right.map((data) => ({ data, path: basePath }));
  const usedRight = new Set<number>();
  const pairs: Array<{ leftIndex: number; rightIndex: number }> = [];
  const leftOnly: number[] = [];
  const rightOnly: number[] = [];

  const rightRemaining = rightItems.map((item, index) => ({ item, index }));
  for (let i = 0; i < leftItems.length; i += 1) {
    const leftItem = leftItems[i];
    if (!leftItem) continue;
    let matched = -1;
    for (const candidate of rightRemaining) {
      if (usedRight.has(candidate.index)) continue;
      if (
        JSON.stringify(canonicalize(leftItem.data, options)) ===
        JSON.stringify(canonicalize(candidate.item.data, options))
      ) {
        matched = candidate.index;
        break;
      }
    }
    if (matched >= 0) {
      usedRight.add(matched);
      pairs.push({ leftIndex: i, rightIndex: matched });
    } else {
      leftOnly.push(i);
    }
  }
  for (let i = 0; i < rightItems.length; i += 1) {
    if (!usedRight.has(i)) rightOnly.push(i);
  }
  return { pairs, leftOnly, rightOnly };
}

/** Stable canonical form used for multiset comparison and re-ordering. */
export function canonicalize(value: unknown, options: DiffOptions): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (options.ignoreListOrder || options.arraysAsMultisets) {
      return value
        .map((item) => JSON.stringify(canonicalize(item, options)))
        .sort()
        .map((encoded) => JSON.parse(encoded) as unknown);
    }
    return value.map((item) => canonicalize(item, options));
  }
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = canonicalize(record[key], options);
  }
  return out;
}

/** Recursively diff two parsed documents into a flat list of differences. */
export function diffData(
  left: unknown,
  right: unknown,
  path: string,
  options: DiffOptions,
  out: DiffEntry[] = []
): DiffEntry[] {
  const bothObjects = isPlainObject(left) && isPlainObject(right);
  const bothArrays = Array.isArray(left) && Array.isArray(right);

  if (bothObjects) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const keys = new Set<string>([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
    const sorted = [...keys].sort();
    for (const key of sorted) {
      const childPath = path ? `${path}.${key}` : key;
      const inLeft = Object.prototype.hasOwnProperty.call(leftRecord, key);
      const inRight = Object.prototype.hasOwnProperty.call(rightRecord, key);
      if (inLeft && !inRight) {
        pushEntry(out, { path: childPath, type: 'removed', old: formatValue(leftRecord[key]) });
      } else if (!inLeft && inRight) {
        pushEntry(out, { path: childPath, type: 'added', new: formatValue(rightRecord[key]) });
      } else {
        diffData(leftRecord[key], rightRecord[key], childPath, options, out);
      }
    }
    return out;
  }

  if (bothArrays) {
    const arrLeft = left as unknown[];
    const arrRight = right as unknown[];
    if (options.ignoreListOrder || options.arraysAsMultisets) {
      const { pairs, leftOnly, rightOnly } = matchMultiset(arrLeft, arrRight, path, options);
      for (const { leftIndex, rightIndex } of pairs) {
        diffData(arrLeft[leftIndex], arrRight[rightIndex], `${path}[${leftIndex}]`, options, out);
      }
      for (const index of leftOnly) {
        pushEntry(out, {
          path: `${path}[${index}]`,
          type: 'removed',
          old: formatValue(arrLeft[index]),
        });
      }
      for (const index of rightOnly) {
        pushEntry(out, {
          path: `${path}[${index}]`,
          type: 'added',
          new: formatValue(arrRight[index]),
        });
      }
      return out;
    }
    const max = Math.max(arrLeft.length, arrRight.length);
    for (let i = 0; i < max; i += 1) {
      const inLeft = i < arrLeft.length;
      const inRight = i < arrRight.length;
      if (inLeft && !inRight) {
        pushEntry(out, { path: `${path}[${i}]`, type: 'removed', old: formatValue(arrLeft[i]) });
      } else if (!inLeft && inRight) {
        pushEntry(out, { path: `${path}[${i}]`, type: 'added', new: formatValue(arrRight[i]) });
      } else {
        diffData(arrLeft[i], arrRight[i], `${path}[${i}]`, options, out);
      }
    }
    return out;
  }

  if (!scalarEqual(left, right)) {
    pushEntry(out, {
      path,
      type: 'changed',
      old: formatValue(left),
      new: formatValue(right),
    });
  }
  return out;
}

function pushEntry(out: DiffEntry[], entry: DiffEntry): void {
  out.push(entry);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

/** Sort a flat diff by the requested key, honouring direction. */
export function sortDiff(diff: DiffEntry[], sortKey: SortKey, desc: boolean): DiffEntry[] {
  const factor = desc ? -1 : 1;
  return [...diff].sort((a, b) => {
    const av = String((a as unknown as Record<string, unknown>)[sortKey] ?? '');
    const bv = String((b as unknown as Record<string, unknown>)[sortKey] ?? '');
    return av.localeCompare(bv, undefined, { numeric: true }) * factor;
  });
}

export interface ComparisonSummary {
  left: ParseOutcome;
  right: ParseOutcome;
  diff: DiffEntry[];
  addedCount: number;
  removedCount: number;
  changedCount: number;
  hasDiff: boolean;
  summary: string;
}

/** Parse both documents and compute the full comparison result. */
export function computeComparison(state: ToolState): ComparisonSummary {
  const options: DiffOptions = {
    ignoreListOrder: state.ignoreListOrder,
    arraysAsMultisets: state.arraysAsMultisets,
  };
  const left = parseYaml(state.leftYaml);
  const right = parseYaml(state.rightYaml);
  let diff: DiffEntry[] = [];
  let summary = '';
  let addedCount = 0;
  let removedCount = 0;
  let changedCount = 0;

  if (left.ok && right.ok) {
    // When order-agnostic options are on, compare canonical forms to detect
    // reorder-only differences as equal (scalars inside reordered arrays).
    const canonicalEqual =
      (options.ignoreListOrder || options.arraysAsMultisets) &&
      JSON.stringify(canonicalize(left.data, options)) ===
        JSON.stringify(canonicalize(right.data, options));
    if (canonicalEqual) {
      summary = 'Documents are semantically identical (order-insensitive comparison).';
    } else {
      diff = diffData(left.data, right.data, '', options);
      addedCount = diff.filter((entry) => entry.type === 'added').length;
      removedCount = diff.filter((entry) => entry.type === 'removed').length;
      changedCount = diff.filter((entry) => entry.type === 'changed').length;
      if (diff.length === 0) {
        summary = 'Documents are semantically identical.';
      } else {
        summary = `${diff.length} difference${diff.length === 1 ? '' : 's'}: ${addedCount} added, ${removedCount} removed, ${changedCount} changed.`;
      }
    }
  } else if (!left.ok && !right.ok) {
    summary = 'Both documents have YAML errors — fix them to compare.';
  } else {
    summary = `Fix the ${!left.ok ? 'left' : 'right'} YAML error to compare.`;
  }

  return {
    left,
    right,
    diff,
    addedCount,
    removedCount,
    changedCount,
    hasDiff: diff.length > 0,
    summary,
  };
}

/** Copyable summary lines for the toolbar copy button. */
export function summaryText(state: ToolState): string {
  const result = computeComparison(state);
  const lines: string[] = [];
  lines.push('YAML Differential Comparator');
  if (!result.left.ok)
    lines.push(`Left: error on line ${result.left.line}: ${result.left.message}`);
  if (!result.right.ok)
    lines.push(`Right: error on line ${result.right.line}: ${result.right.message}`);
  lines.push(result.summary);
  for (const entry of result.diff) {
    lines.push(formatDiffLine(entry));
  }
  return lines.join('\n');
}

/** One canonical line per difference for reports. */
export function formatDiffLine(entry: DiffEntry): string {
  const where =
    entry.leftLine !== undefined
      ? ` (left line ${entry.leftLine})`
      : entry.rightLine !== undefined
        ? ` (right line ${entry.rightLine})`
        : '';
  if (entry.type === 'added') return `+ ${entry.path} = ${entry.new ?? ''}${where}`;
  if (entry.type === 'removed') return `- ${entry.path} = ${entry.old ?? ''}${where}`;
  return `~ ${entry.path}: ${entry.old ?? ''} → ${entry.new ?? ''}${where}`;
}

/** Persisted sub-state mirrors computed summary numbers for share URLs. */
export function computeComparisonSummary(state: ToolState): ComparisonSummary {
  return computeComparison(state);
}

/** Strip computed fields before serialization so share URLs stay small. */
export function serializeInputs(state: ToolState): ToolState {
  return {
    ...state,
    diff: state.diff,
  };
}
