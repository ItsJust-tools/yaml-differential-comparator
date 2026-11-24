'use client';

import React from 'react';
import type { ToolState } from '../tool-core';

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="yaml-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">How it works</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>Paste YAML on the left and right panels.</li>
          <li>Both documents are parsed, then the data structures are diffed.</li>
          <li>Formatting, key order and quoting style never cause false differences.</li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Options</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Use the toolbar toggles to ignore list order or compare arrays as multisets — arrays with
          the same elements in a different order then compare equal.
        </p>
        <p
          className="mt-1 text-xs text-gray-600 dark:text-gray-300"
          data-testid="sidebar-mode-state"
        >
          ignoreListOrder: {String(state.ignoreListOrder)} · arraysAsMultisets:{' '}
          {String(state.arraysAsMultisets)}
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Paths</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          Differences are reported in dot notation, e.g.{' '}
          <code className="font-mono">services.web.image</code>, so you can copy them straight into
          scripts or issue reports.
        </p>
      </div>
    </div>
  );
};

export default Sidebar;
