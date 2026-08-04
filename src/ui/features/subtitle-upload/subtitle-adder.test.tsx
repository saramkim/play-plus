import { act } from 'react';

import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleAdder } from './subtitle-adder';

const addedSubtitle: V2RegisteredSubtitleMetadata = {
  id: 'subtitle-00000000-0000-0000-0000-000000000001',
  title: 'Lesson',
  language: 'en',
  savedAt: '2026-08-04T00:00:00.000Z',
};

vi.mock('./subtitle-uploader', () => ({
  SubtitleUploader: ({
    focusOnMount,
    onAdded,
    onBusyChange,
  }: {
    focusOnMount: boolean;
    onAdded: (subtitle: V2RegisteredSubtitleMetadata) => void;
    onBusyChange: (busy: boolean) => void;
  }) => (
    <section data-focus-on-mount={String(focusOnMount)}>
      <button type='button' onClick={() => onBusyChange(true)}>
        start
      </button>
      <button type='button' onClick={() => onBusyChange(false)}>
        finish
      </button>
      <button type='button' onClick={() => onAdded(addedSubtitle)}>
        add
      </button>
    </section>
  ),
}));

describe('SubtitleAdder', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders only the file uploader and forwards focus, busy, and added state', () => {
    const onAdded = vi.fn();
    const onBusyChange = vi.fn();

    act(() => {
      root.render(
        <SubtitleAdder focusFirstControl onAdded={onAdded} onBusyChange={onBusyChange} />
      );
    });

    expect(container.querySelector('section')?.dataset.focusOnMount).toBe('true');
    expect(container.querySelectorAll('button')).toHaveLength(3);

    const buttons = Array.from(container.querySelectorAll('button'));
    act(() => buttons[0].click());
    act(() => buttons[1].click());
    act(() => buttons[2].click());

    expect(onBusyChange.mock.calls).toEqual([[true], [false]]);
    expect(onAdded).toHaveBeenCalledWith(addedSubtitle);
  });
});
