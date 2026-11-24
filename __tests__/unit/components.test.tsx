import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Canvas } from '@/tool/components/Canvas';
import { Toolbar } from '@/tool/components/Toolbar';
import { Sidebar } from '@/tool/components/Sidebar';
import { DEFAULT_STATE, type ToolState } from '@/tool/tool-core';

const base = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const diffState = () =>
  base({
    leftYaml: 'a:\n  b: 1\nlist:\n  - x\n',
    rightYaml: 'a:\n  b: 2\nlist:\n  - x\n  - y\nextra: true\n',
  });

describe('Canvas', () => {
  it('renders both inputs and propagates edits', () => {
    const onChange = vi.fn();
    render(<Canvas state={base()} onChange={onChange} />);
    fireEvent.change(screen.getByTestId('input-left-yaml'), { target: { value: 'z: 1\n' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ leftYaml: 'z: 1\n' }));
    fireEvent.change(screen.getByTestId('input-right-yaml'), { target: { value: 'z: 2\n' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rightYaml: 'z: 2\n' }));
  });

  it('shows line-accurate parse errors and no diff list', () => {
    render(<Canvas state={base({ leftYaml: 'a: [oops\n' })} />);
    expect(screen.getByTestId('left-error')).toHaveTextContent('Line 2');
    expect(screen.getByTestId('diff-empty')).toBeInTheDocument();
  });

  it('lists differences with copyable dot-notation paths', () => {
    render(<Canvas state={diffState()} />);
    expect(screen.getByTestId('count-added')).toHaveTextContent('Added: 2');
    expect(screen.getByTestId('count-removed')).toHaveTextContent('Removed: 0');
    expect(screen.getByTestId('count-changed')).toHaveTextContent('Changed: 1');
    expect(screen.getByTestId('diff-row-a.b')).toHaveTextContent('a.b');
    fireEvent.click(screen.getByTestId('diff-row-a.b'));
    expect(screen.getByTestId('diff-detail-a.b')).toHaveTextContent('a.b');
  });

  it('renders identical documents without differences', () => {
    render(<Canvas state={base({ leftYaml: 'x: 1\n', rightYaml: 'x: 1\n' })} />);
    expect(screen.getByTestId('result-main')).toHaveTextContent(
      'Documents are semantically identical.'
    );
    expect(screen.getByTestId('diff-empty')).toHaveTextContent('No differences detected.');
  });
});

describe('Toolbar', () => {
  it('swaps inputs and toggles options', () => {
    const onChange = vi.fn();
    render(
      <Toolbar
        state={base({ leftYaml: 'L', rightYaml: 'R' })}
        onChange={onChange}
        onClear={() => {}}
      />
    );
    fireEvent.click(screen.getByTestId('btn-swap'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ leftYaml: 'R', rightYaml: 'L' })
    );
    fireEvent.click(screen.getByTestId('btn-toggle-ignore-list-order'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ ignoreListOrder: true }));
    fireEvent.click(screen.getByTestId('btn-toggle-multisets'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ arraysAsMultisets: true }));
    fireEvent.click(screen.getByTestId('btn-cycle-sort'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sortKey: 'type' }));
    fireEvent.click(screen.getByTestId('btn-toggle-sort-dir'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ sortDesc: true }));
  });

  it('invokes clear and copy callbacks', async () => {
    const onClear = vi.fn();
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText },
    });
    render(<Toolbar state={base()} onChange={() => {}} onClear={onClear} onCopy={onCopy} />);
    fireEvent.click(screen.getByTestId('btn-clear'));
    expect(onClear).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('btn-copy-result'));
    await vi.waitFor(() => expect(onCopy).toHaveBeenCalled());
  });
});

describe('Sidebar', () => {
  it('shows current option state', () => {
    render(
      <Sidebar
        state={base({ ignoreListOrder: true, arraysAsMultisets: true })}
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId('sidebar-mode-state')).toHaveTextContent('ignoreListOrder: true');
    expect(screen.getByTestId('sidebar-mode-state')).toHaveTextContent('arraysAsMultisets: true');
  });
});
