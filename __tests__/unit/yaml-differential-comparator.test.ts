import { describe, it, expect } from 'vitest';
import {
  parseYaml,
  diffData,
  sortDiff,
  computeComparison,
  summaryText,
  formatValue,
  canonicalize,
  DEFAULT_STATE,
  type DiffEntry,
  type ToolState,
} from '@/tool/tool-core';
import {
  deserializeState,
  serializeState,
  roundTrips,
  yamlComparatorTool,
} from '@/tool/tool-definition';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const opts = (patch: Partial<{ ignoreListOrder: boolean; arraysAsMultisets: boolean }> = {}) => ({
  ignoreListOrder: false,
  arraysAsMultisets: false,
  ...patch,
});

describe('parseYaml', () => {
  it('parses valid documents', () => {
    const result = parseYaml('a: 1\nb:\n  - x\n  - y\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ a: 1, b: ['x', 'y'] });
    }
  });

  it('reports a line-accurate error for invalid documents', () => {
    const result = parseYaml('a: 1\nb: [unclosed\n');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // js-yaml detects the unterminated flow collection at EOF (line 3).
      expect(result.line).toBe(3);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('does not crash on empty input', () => {
    const result = parseYaml('');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBeUndefined();
  });
});

describe('diffData', () => {
  it('detects changed scalars with old and new values at dot-notation paths', () => {
    const diff = diffData(
      { services: { web: { image: 'nginx:1.25', replicas: 2 } } },
      { services: { web: { image: 'nginx:1.27', replicas: 2 } } },
      '',
      opts()
    );
    expect(diff).toHaveLength(1);
    const entry = diff[0];
    expect(entry?.path).toBe('services.web.image');
    expect(entry?.type).toBe('changed');
    expect(entry?.old).toBe('"nginx:1.25"');
    expect(entry?.new).toBe('"nginx:1.27"');
  });

  it('categorizes added and removed keys correctly', () => {
    const diff = diffData({ keep: 1, gone: 'x' }, { keep: 1, fresh: true }, '', opts());
    const byPath = Object.fromEntries(diff.map((entry) => [entry.path, entry]));
    expect(byPath['gone']?.type).toBe('removed');
    expect(byPath['gone']?.old).toBe('"x"');
    expect(byPath['fresh']?.type).toBe('added');
    expect(byPath['fresh']?.new).toBe('true');
    expect(byPath['keep']).toBeUndefined();
  });

  it('diffs nested maps inside arrays recursively', () => {
    const diff = diffData(
      {
        items: [
          { name: 'a', port: 80 },
          { name: 'b', port: 443 },
        ],
      },
      {
        items: [
          { name: 'a', port: 8080 },
          { name: 'b', port: 443 },
        ],
      },
      '',
      opts()
    );
    expect(diff).toHaveLength(1);
    expect(diff[0]?.path).toBe('items[0].port');
    expect(diff[0]?.type).toBe('changed');
    expect(diff[0]?.old).toBe('80');
    expect(diff[0]?.new).toBe('8080');
  });

  it('compares arrays element-wise by default, flagging reorders as changes', () => {
    const diff = diffData({ list: [1, 2] }, { list: [2, 1] }, '', opts());
    expect(diff).toHaveLength(2);
    expect(diff.map((entry) => entry.type)).toEqual(['changed', 'changed']);
  });

  it('ignore-list-order makes reordered arrays equal', () => {
    const diff = diffData({ list: [1, 2] }, { list: [2, 1] }, '', opts({ ignoreListOrder: true }));
    expect(diff).toHaveLength(0);
  });

  it('arrays-as-multisets also ignores order', () => {
    const diff = diffData(
      { list: ['x', 'y'] },
      { list: ['y', 'x'] },
      '',
      opts({ arraysAsMultisets: true })
    );
    expect(diff).toHaveLength(0);
  });

  it('still reports added/removed elements when order-insensitive', () => {
    const diff = diffData(
      { list: [1, 2, 3] },
      { list: [3, 2, 9] },
      '',
      opts({ ignoreListOrder: true })
    );
    const types = diff.map((entry) => entry.type).sort();
    expect(types).toEqual(['added', 'removed']);
  });
});

describe('sortDiff', () => {
  it('sorts by key and reverses with desc', () => {
    const diff: DiffEntry[] = [
      { path: 'b', type: 'added', new: '1' },
      { path: 'a', type: 'removed', old: '2' },
    ];
    expect(sortDiff(diff, 'path', false)[0]?.path).toBe('a');
    expect(sortDiff(diff, 'path', true)[0]?.path).toBe('b');
    expect(sortDiff(diff, 'type', false)[0]?.type).toBe('added');
  });
});

describe('computeComparison', () => {
  it('summarizes counts and produces a copyable report', () => {
    const result = computeComparison(
      state({
        leftYaml: 'a: 1\nb: 2\n',
        rightYaml: 'a: 9\nc: 3\n',
      })
    );
    expect(result.left.ok && result.right.ok).toBe(true);
    expect(result.addedCount).toBe(1);
    expect(result.removedCount).toBe(1);
    expect(result.changedCount).toBe(1);
    expect(result.summary).toBe('3 differences: 1 added, 1 removed, 1 changed.');
    const report = summaryText(state({ leftYaml: 'a: 1\n', rightYaml: 'a: 9\n' }));
    expect(report).toContain('~ a: 1 → 9');
  });

  it('reports parse errors without crashing', () => {
    const result = computeComparison(state({ leftYaml: 'a: [oops\n', rightYaml: 'b: 1\n' }));
    expect(result.left.ok).toBe(false);
    expect(result.right.ok).toBe(true);
    expect(result.summary).toContain('left');
    expect(result.diff).toEqual([]);
  });

  it('reports identical documents as no differences', () => {
    const result = computeComparison(state({ leftYaml: 'a: 1\n', rightYaml: 'a: 1\n' }));
    expect(result.hasDiff).toBe(false);
    expect(result.summary).toBe('Documents are semantically identical.');
  });

  it('treats reordered lists as identical when ignoreListOrder is on', () => {
    const result = computeComparison(
      state({
        leftYaml: 'list:\n  - 1\n  - 2\n',
        rightYaml: 'list:\n  - 2\n  - 1\n',
        ignoreListOrder: true,
      })
    );
    expect(result.hasDiff).toBe(false);
    expect(result.summary).toContain('order-insensitive');
  });
});

describe('formatValue and canonicalize', () => {
  it('formats scalars with quoting', () => {
    expect(formatValue('x')).toBe('"x"');
    expect(formatValue(3)).toBe('3');
    expect(formatValue(null)).toBe('null');
    expect(formatValue({ a: 1 })).toContain('a:');
  });

  it('canonicalizes objects with sorted keys and sorted arrays', () => {
    const a = canonicalize({ b: 1, a: [3, 1, 2] }, opts({ ignoreListOrder: true }));
    const b = canonicalize({ a: [2, 3, 1], b: 1 }, opts({ ignoreListOrder: true }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('serialize/deserialize', () => {
  it('round-trips full state', () => {
    const full = state({ leftYaml: 'x: 1\n', rightYaml: 'y: 2\n', ignoreListOrder: true });
    expect(roundTrips(full)).toBe(true);
  });

  it('repairs invalid payloads to defaults', () => {
    const repaired = deserializeState({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.leftYaml).toBe(DEFAULT_STATE.leftYaml);
      expect(repaired.data.ignoreListOrder).toBe(false);
    }
    expect(deserializeState('not-an-object').success).toBe(false);
  });

  it('keeps valid diff entries and drops malformed ones', () => {
    const result = deserializeState({
      diff: [
        { path: 'a.b', type: 'changed', old: '1', new: '2' },
        { path: 42, type: 'bogus' },
        {
          path: 'c',
          type: 'added',
          new: 'x',
          children: [{ path: 'c.d', type: 'added', new: 'y' }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.diff).toHaveLength(2);
      expect(result.data.diff[1]?.children).toHaveLength(1);
    }
  });

  it('exposes the tool identity through the Tool object', () => {
    expect(yamlComparatorTool.id).toBe('yaml-differential-comparator');
    expect(yamlComparatorTool.name).toBe('YAML Differential Comparator');
    expect(yamlComparatorTool.serialize(state())).toBe(serializeState(state()));
    expect(yamlComparatorTool.initialState.leftYaml).toBe(DEFAULT_STATE.leftYaml);
  });
});
