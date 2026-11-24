export { default as toolConfig } from './tool.config';
export { templateBaseVersion } from './template-metadata';
export { templateMetadata, getPublicSiteUrl } from './template-metadata';
export {
  yamlComparatorTool,
  serializeState,
  deserializeState,
  roundTrips,
} from './tool-definition';
export { Canvas } from './components/Canvas';
export { Sidebar } from './components/Sidebar';
export { Toolbar } from './components/Toolbar';
export {
  DEFAULT_STATE,
  parseYaml,
  diffData,
  sortDiff,
  computeComparison,
  computeComparisonSummary,
  summaryText,
  formatDiffLine,
  formatValue,
  canonicalize,
} from './tool-core';
export type { ToolState, DiffEntry, SortKey, ParseOutcome, ComparisonSummary } from './tool-core';
