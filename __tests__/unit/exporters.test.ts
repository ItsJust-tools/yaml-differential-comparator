import { describe, it, expect } from 'vitest';
import type { ExportOptions } from '@itsjust/core';
import jsonExporter from '@/tool/exporters/json';
import { DEFAULT_STATE, computeComparison, type ToolState } from '@/tool/tool-core';

const stateWith = (patch: Partial<ToolState>): ToolState => ({ ...DEFAULT_STATE, ...patch });

describe('json exporter', () => {
  it('exports comparison results as JSON from provided state', async () => {
    const state = stateWith({ leftYaml: 'a: 1\n', rightYaml: 'a: 2\n' });
    const result = await jsonExporter.export(document.createElement('div'), {
      state,
    } as ExportOptions & { state: ToolState });
    expect(result.success).toBe(true);
    expect(result.format).toBe('json');
    expect(result.filename).toBe('yaml-diff.json');
    const payload = JSON.parse(String(result.data)) as {
      summary: string;
      added: number;
      removed: number;
      changed: number;
      differences: unknown[];
    };
    expect(payload.changed).toBe(1);
    expect(payload.differences).toEqual(computeComparison(state).diff);
  });

  it('exports an empty payload when no state is supplied', async () => {
    const result = await jsonExporter.export(document.createElement('div'), {} as ExportOptions);
    const payload = JSON.parse(String(result.data)) as {
      summary: string;
      differences: unknown[];
    };
    expect(payload.summary).toBe('');
    expect(payload.differences).toEqual([]);
  });
});
