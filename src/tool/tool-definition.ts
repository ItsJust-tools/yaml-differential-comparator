import {
  DEFAULT_STATE,
  type ToolState,
  type DiffEntry,
  computeComparisonSummary,
  serializeInputs,
} from './tool-core';
import type { DeserializeResult, Tool } from '@itsjust/core';
import toolConfig from './tool.config';

const VALID_SORT_KEYS = ['path', 'type', 'old', 'new'];

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify(serializeInputs(state));
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: `Invalid data format: expected ${toolConfig.id} state object`,
    };
  }
  const v = data as Record<string, unknown>;
  const sortKey =
    typeof v.sortKey === 'string' && VALID_SORT_KEYS.includes(v.sortKey)
      ? (v.sortKey as ToolState['sortKey'])
      : DEFAULT_STATE.sortKey;
  const state: ToolState = {
    leftYaml: stringOr(v.leftYaml, DEFAULT_STATE.leftYaml),
    rightYaml: stringOr(v.rightYaml, DEFAULT_STATE.rightYaml),
    ignoreListOrder:
      typeof v.ignoreListOrder === 'boolean' ? v.ignoreListOrder : DEFAULT_STATE.ignoreListOrder,
    arraysAsMultisets:
      typeof v.arraysAsMultisets === 'boolean'
        ? v.arraysAsMultisets
        : DEFAULT_STATE.arraysAsMultisets,
    leftError: stringOr(v.leftError, DEFAULT_STATE.leftError),
    rightError: stringOr(v.rightError, DEFAULT_STATE.rightError),
    summary: stringOr(v.summary, DEFAULT_STATE.summary),
    addedCount:
      typeof v.addedCount === 'number' && Number.isFinite(v.addedCount)
        ? v.addedCount
        : DEFAULT_STATE.addedCount,
    removedCount:
      typeof v.removedCount === 'number' && Number.isFinite(v.removedCount)
        ? v.removedCount
        : DEFAULT_STATE.removedCount,
    changedCount:
      typeof v.changedCount === 'number' && Number.isFinite(v.changedCount)
        ? v.changedCount
        : DEFAULT_STATE.changedCount,
    leftOk: typeof v.leftOk === 'boolean' ? v.leftOk : DEFAULT_STATE.leftOk,
    rightOk: typeof v.rightOk === 'boolean' ? v.rightOk : DEFAULT_STATE.rightOk,
    hasDiff: typeof v.hasDiff === 'boolean' ? v.hasDiff : DEFAULT_STATE.hasDiff,
    sortKey,
    sortDesc: typeof v.sortDesc === 'boolean' ? v.sortDesc : DEFAULT_STATE.sortDesc,
    expandedPaths:
      Array.isArray(v.expandedPaths) && v.expandedPaths.every((p) => typeof p === 'string')
        ? (v.expandedPaths as string[])
        : DEFAULT_STATE.expandedPaths,
    diff: validDiff(v.diff),
  };
  return { success: true, data: state };
}

function validDiff(value: unknown): DiffEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is DiffEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as DiffEntry).path === 'string' &&
        typeof (entry as DiffEntry).type === 'string' &&
        ['added', 'removed', 'changed'].includes((entry as DiffEntry).type)
    )
    .map((entry) => ({
      path: entry.path,
      type: entry.type,
      old: typeof entry.old === 'string' ? entry.old : undefined,
      new: typeof entry.new === 'string' ? entry.new : undefined,
      leftLine: typeof entry.leftLine === 'number' ? entry.leftLine : undefined,
      rightLine: typeof entry.rightLine === 'number' ? entry.rightLine : undefined,
      children: Array.isArray(entry.children) ? validDiff(entry.children) : undefined,
    }));
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

/** The registered Tool instance assembled from the pure helpers above. */
export const yamlComparatorTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [{ format: 'json', loader: () => import('./exporters/json') }],
};

export { computeComparisonSummary, serializeInputs };
