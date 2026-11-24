import type { ToolConfig } from '@itsjust/core';

export const toolConfig: ToolConfig = {
  id: 'yaml-differential-comparator',
  name: 'YAML Differential Comparator',
  description:
    'Compare two YAML files and highlight semantic differences between parsed data structures, ignoring formatting, key order and quoting style.',
  version: '1.0.0',
  exportFormats: ['json'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: false,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  ogImage: '/og.svg',
  theme: {
    accent: '#0ea5e9',
    accentHover: '#0284c7',
    accentSubtle: 'rgba(14, 165, 233, 0.08)',
    brand: 'YAML Differential Comparator',
    icon: '🧾',
  },
};

export default toolConfig;
