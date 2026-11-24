'use client';

import React from 'react';
import {
  computeComparison,
  sortDiff,
  formatDiffLine,
  type DiffEntry,
  type ToolState,
} from '../tool-core';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
  onSaveHistory?: (text: string) => void;
}

const textareaClass =
  'mt-1 w-full h-72 rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function EntryRow({ entry }: { entry: DiffEntry }) {
  const [open, setOpen] = React.useState(false);
  const badge =
    entry.type === 'added'
      ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
      : entry.type === 'removed'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  const marker = entry.type === 'added' ? '+' : entry.type === 'removed' ? '−' : '~';
  return (
    <li className="rounded-md border border-gray-200 dark:border-gray-800" data-testid="diff-entry">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        data-testid={`diff-row-${entry.path}`}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
      >
        <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${badge}`}>
          {marker} {entry.type}
        </span>
        <span className="font-mono text-gray-900 dark:text-gray-100">{entry.path}</span>
        <span className="ml-auto flex items-center gap-2 text-gray-600 dark:text-gray-300">
          {entry.type === 'changed' ? (
            <>
              <span className="font-mono">{entry.old}</span>
              <span>→</span>
              <span className="font-mono">{entry.new}</span>
            </>
          ) : (
            <span className="font-mono">{entry.type === 'added' ? entry.new : entry.old}</span>
          )}
          <span className="text-gray-400">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open ? (
        <div
          className="border-t border-gray-100 px-3 py-2 text-xs dark:border-gray-800"
          data-testid={`diff-detail-${entry.path}`}
        >
          <CopyableLine label="Path" value={entry.path} testid={`copy-path-${entry.path}`} />
          <CopyableLine
            label="Change"
            value={formatDiffLine(entry)}
            testid={`copy-line-${entry.path}`}
          />
          {entry.leftLine !== undefined ? `Left line: ${entry.leftLine} · ` : ''}
          {entry.rightLine !== undefined ? `Right line: ${entry.rightLine}` : ''}
        </div>
      ) : null}
    </li>
  );
}

function CopyableLine({ label, value, testid }: { label: string; value: string; testid: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <code className="flex-1 truncate font-mono text-gray-900 dark:text-gray-100">{value}</code>
      <button
        type="button"
        data-testid={testid}
        aria-label={`Copy ${label.toLowerCase()}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          } catch {
            // clipboard unavailable; ignore
          }
        }}
        className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const result = computeComparison(state);
  const sorted = sortDiff(result.diff, state.sortKey, state.sortDesc);

  const leftErrorBlock = !result.left.ok ? (
    <p
      className="mt-1 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
      data-testid="left-error"
    >
      Line {result.left.line}: {result.left.message}
    </p>
  ) : null;
  const rightErrorBlock = !result.right.ok ? (
    <p
      className="mt-1 rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200"
      data-testid="right-error"
    >
      Line {result.right.line}: {result.right.message}
    </p>
  ) : null;

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full" data-testid="yaml-canvas">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Left YAML
            <textarea
              value={state.leftYaml}
              onChange={(e) => update({ leftYaml: e.target.value })}
              data-testid="input-left-yaml"
              className={textareaClass}
              spellCheck={false}
            />
          </label>
          {leftErrorBlock}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Right YAML
            <textarea
              value={state.rightYaml}
              onChange={(e) => update({ rightYaml: e.target.value })}
              data-testid="input-right-yaml"
              className={textareaClass}
              spellCheck={false}
            />
          </label>
          {rightErrorBlock}
        </div>
      </div>

      <div
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
        data-testid="result-card"
        role="status"
      >
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-400">
          Comparison
        </span>
        <span className="block font-mono text-lg" data-testid="result-main">
          {result.summary || '—'}
        </span>
        <span className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
          <span data-testid="count-added">Added: {result.addedCount}</span>
          <span data-testid="count-removed">Removed: {result.removedCount}</span>
          <span data-testid="count-changed">Changed: {result.changedCount}</span>
        </span>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Differences
        </h3>
        {sorted.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="diff-empty">
            {result.left.ok && result.right.ok
              ? 'No differences detected.'
              : 'Fix parse errors to see differences.'}
          </p>
        ) : (
          <ul className="space-y-1" data-testid="diff-list">
            {sorted.map((entry) => (
              <EntryRow key={`${entry.type}-${entry.path}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400">
        All parsing and comparison runs locally in your browser; nothing is uploaded.
      </p>
    </div>
  );
};

export default Canvas;
