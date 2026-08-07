import { act } from 'react';

import type { SubtitleId } from '@storage/subtitle';
import type { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleCard } from './subtitle-card';

const SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001' as SubtitleId;
const subtitle: V2RegisteredSubtitleMetadata = {
  id: SUBTITLE_ID,
  title: 'Registered source',
  language: 'en',
  savedAt: '2026-08-01T00:00:00.000Z',
};

describe('SubtitleCard preview action', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(chrome.i18n.getMessage).mockImplementation((key) => key);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('opens a registered subtitle preview without requiring a playable role', () => {
    const onPreview = vi.fn();
    const previewButtonRef = vi.fn();
    renderCard(root, { onPreview, previewButtonRef });

    const previewButton = getButton(container, 'v2_local_subtitles_preview');
    expect(previewButton.disabled).toBe(false);
    expect(previewButton.dataset.subtitlePreviewId).toBe(SUBTITLE_ID);
    expect(previewButtonRef).toHaveBeenCalledWith(previewButton);

    act(() => previewButton.click());
    expect(onPreview).toHaveBeenCalledOnce();
    expect(onPreview).toHaveBeenCalledWith(SUBTITLE_ID);
  });

  it('disables preview navigation only when the card or page is busy', () => {
    renderCard(root, { previewDisabled: true });
    expect(getButton(container, 'v2_local_subtitles_preview').disabled).toBe(true);

    renderCard(root, {
      pendingRoles: { learning: true, support: false },
      previewDisabled: false,
    });
    expect(getButton(container, 'v2_local_subtitles_preview').disabled).toBe(true);
  });
});

function renderCard(
  root: Root,
  overrides: Partial<React.ComponentProps<typeof SubtitleCard>> = {}
) {
  act(() =>
    root.render(
      <SubtitleCard
        data={subtitle}
        itemRef={() => undefined}
        tabInfo={null}
        isAvailable={false}
        isRoleAvailable={() => false}
        pendingRoles={{ learning: false, support: false }}
        onDelete={() => undefined}
        onEdit={async () => undefined}
        onPreview={() => undefined}
        onUpdateDelay={async () => undefined}
        onRoleChange={() => undefined}
        {...overrides}
      />
    )
  );
}

const getButton = (container: HTMLElement, accessibleName: string) => {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) =>
      candidate.getAttribute('aria-label') === accessibleName ||
      candidate.textContent === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
};
