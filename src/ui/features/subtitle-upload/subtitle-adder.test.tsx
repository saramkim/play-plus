import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleAdder } from './subtitle-adder';

vi.mock('./open-subtitles-search', () => ({
  OpenSubtitlesSearch: () => <input aria-label='online-draft' defaultValue='Online draft' />,
}));

vi.mock('./subtitle-uploader', () => ({
  SubtitleUploader: () => <input aria-label='file-draft' defaultValue='File draft' />,
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
      root.render(
        <SubtitleAdder
          initialSource='file'
          onAdded={vi.fn()}
          onBusyChange={vi.fn()}
        />
      );
    });

    const fileDraft = container.querySelector<HTMLInputElement>("input[aria-label='file-draft']");
    const onlineDraft = container.querySelector<HTMLInputElement>("input[aria-label='online-draft']");
    const onlineToggle = container.querySelector<HTMLButtonElement>("button[aria-label='find_online']");
    const fileToggle = container.querySelector<HTMLButtonElement>("button[aria-label='add_from_file']");

    expect(fileDraft).not.toBeNull();
    expect(onlineDraft).not.toBeNull();
    expect(fileDraft?.closest('[hidden]')).toBeNull();
    expect(onlineDraft?.closest('[hidden]')).not.toBeNull();

    if (!fileDraft || !onlineDraft || !onlineToggle || !fileToggle) throw new Error('Expected subtitle source controls');
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
});
