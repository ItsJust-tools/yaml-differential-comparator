import type { Exporter, ExportOptions, ExportResult } from '@itsjust/core';
import type { ToolState } from '../tool-core';
import { computeComparison } from '../tool-core';

const jsonExporter: Exporter = {
  format: 'json',
  export: async (
    _element: HTMLElement,
    options: ExportOptions & { state?: ToolState; stateSerializer?: () => string }
  ): Promise<ExportResult> => {
    let summary = '';
    let added = 0;
    let removed = 0;
    let changed = 0;
    let differences: ReturnType<typeof computeComparison>['diff'] = [];
    const state = options.state;
    if (state) {
      const result = computeComparison(state);
      summary = result.summary;
      added = result.addedCount;
      removed = result.removedCount;
      changed = result.changedCount;
      differences = result.diff;
    }
    const payload = JSON.stringify({ summary, added, removed, changed, differences }, null, 2);
    return {
      success: true,
      data: payload,
      filename: 'yaml-diff.json',
      format: 'json',
    };
  },
};

export default jsonExporter;
