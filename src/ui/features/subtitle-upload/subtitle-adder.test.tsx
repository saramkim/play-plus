import { act } from 'react';

import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleAdder } from './subtitle-adder';

const addedSubtitle: V2RegisteredSubtitleMetadata = {
  id: 'subtitle-00000000-0000-4000-8000-000000000001',
  title: 'Lesson',
  language: 'en',
  savedAt: '2026-08-04T00:00:00.000Z',
};

vi.mock('./open-subtitles-search', () => ({
  OpenSubtitlesSearch: ({
    onAdded,
    onBusyChange,
  }: {
    onAdded: (subtitle: V2RegisteredSubtitleMetadata) => void;
    onBusyChange: (busy: boolean) => void;
  }) => (
    <section>
      <input aria-label='online-draft' defaultValue='Online draft' />
      <button type='button' onClick={() => onBusyChange(true)}>online-start</button>
      <button type='button' onClick={() => onBusyChange(false)}>online-finish</button>
      <button type='button' onClick={() => onAdded(addedSubtitle)}>online-add</button>
    </section>
  ),
}));

vi.mock('./subtitle-uploader', () => ({
  SubtitleUploader: ({
    onAdded,
    onBusyChange,
  }: {
    onAdded: (subtitle: V2RegisteredSubtitleMetadata) => void;
    onBusyChange: (busy: boolean) => void;
  }) => (
    <section>
      <input aria-label='file-draft' defaultValue='File draft' />
      <button type='button' onClick={() => onBusyChange(true)}>file-start</button>
      <button type='button' onClick={() => onBusyChange(false)}>file-finish</button>
      <button type='button' onClick={() => onAdded(addedSubtitle)}>file-add</button>
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

  it('keeps both source drafts mounted while hiding the inactive workflow', () => {
    act(() => {
      root.render(<SubtitleAdder initialSource='file' onAdded={vi.fn()} onBusyChange={vi.fn()} />);
    });

    const fileDraft = container.querySelector<HTMLInputElement>("input[aria-label='file-draft']");
    const onlineDraft = container.querySelector<HTMLInputElement>("input[aria-label='online-draft']");
    const onlineToggle = getButton(container, 'find_online');
    const fileToggle = getButton(container, 'add_from_file');

    expect(fileDraft?.closest('[hidden]')).toBeNull();
    expect(onlineDraft?.closest('[hidden]')).not.toBeNull();
    if (!fileDraft || !onlineDraft) throw new Error('Expected both subtitle drafts');
    fileDraft.value = 'Preserved file draft';
    onlineDraft.value = 'Preserved online draft';

    act(() => onlineToggle.click());

    expect(fileDraft.closest('[hidden]')).not.toBeNull();
    expect(onlineDraft.closest('[hidden]')).toBeNull();
    expect(fileDraft.value).toBe('Preserved file draft');
    expect(document.activeElement).toBe(onlineToggle);

    act(() => fileToggle.click());

    expect(fileDraft.closest('[hidden]')).toBeNull();
    expect(onlineDraft.closest('[hidden]')).not.toBeNull();
    expect(onlineDraft.value).toBe('Preserved online draft');
    expect(document.activeElement).toBe(fileToggle);
  });

  it('aggregates busy state and forwards successful registration from either source', () => {
    const onAdded = vi.fn();
    const onBusyChange = vi.fn();
    act(() => {
      root.render(<SubtitleAdder initialSource='online' onAdded={onAdded} onBusyChange={onBusyChange} />);
    });

    act(() => getButton(container, 'online-start').click());
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(getButton(container, 'add_from_file').disabled).toBe(true);
    expect(getButton(container, 'find_online').disabled).toBe(true);

    act(() => getButton(container, 'online-finish').click());
    expect(onBusyChange).toHaveBeenLastCalledWith(false);

    act(() => getButton(container, 'online-add').click());
    expect(onAdded).toHaveBeenCalledWith(addedSubtitle);
  });
});

function getButton(container: HTMLElement, name: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name || candidate.textContent === name
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
}
