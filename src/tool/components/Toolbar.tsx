'use client';

import React from 'react';
import type { ToolState, SortKey } from '../tool-core';

interface ToolbarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onClear: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ state, onChange, onClear, onCopy }) => {
  const swap = () => {
    onChange({ ...state, leftYaml: state.rightYaml, rightYaml: state.leftYaml });
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2" role="group" aria-label="YAML compare controls">
        <button
          type="button"
          onClick={swap}
          data-testid="btn-swap"
          title="Swap left and right inputs"
          className="rounded-md bg-sky-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
        >
          ⇄ Swap sides
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...state, ignoreListOrder: !state.ignoreListOrder })}
          aria-pressed={state.ignoreListOrder}
          data-testid="btn-toggle-ignore-list-order"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            state.ignoreListOrder
              ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Ignore list order
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...state, arraysAsMultisets: !state.arraysAsMultisets })}
          aria-pressed={state.arraysAsMultisets}
          data-testid="btn-toggle-multisets"
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
            state.arraysAsMultisets
              ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/40 dark:text-sky-100'
              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          Compare arrays as multisets
        </button>
        <button
          type="button"
          onClick={() => {
            const keys: SortKey[] = ['path', 'type', 'old', 'new'];
            const index = keys.indexOf(state.sortKey);
            const next = keys[(index + 1) % keys.length] ?? 'path';
            onChange({ ...state, sortKey: next });
          }}
          data-testid="btn-cycle-sort"
          title="Cycle sort column"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Sort: {state.sortKey}
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...state, sortDesc: !state.sortDesc })}
          data-testid="btn-toggle-sort-dir"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {state.sortDesc ? '↓ Desc' : '↑ Asc'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-sky-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-600"
          >
            Copy report
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClear}
          data-testid="btn-clear"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
