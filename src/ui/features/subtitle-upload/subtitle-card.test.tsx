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

describe('SubtitleCard', () => {
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
    expect(getButton(container, 'learning_subtitle').disabled).toBe(true);
    expect(getButton(container, 'support_subtitle').disabled).toBe(true);

    renderCard(root, {
      pendingRoles: { learning: true, support: false },
      previewDisabled: false,
    });
    expect(getButton(container, 'v2_local_subtitles_preview').disabled).toBe(true);
  });

  it('presents title-first identity and orders preview before role and utility actions', () => {
    renderCard(root, {
      isAvailable: true,
      isRoleAvailable: () => true,
      tabInfo: { learningSubtitleId: SUBTITLE_ID },
    });

    const card = container.querySelector('li');
    const header = card?.querySelector('header');
    const title = header?.firstElementChild;
    if (!(card instanceof HTMLLIElement) || !(header instanceof HTMLElement) || !(title instanceof HTMLHeadingElement)) {
      throw new Error('Expected a subtitle card with a title-first header');
    }

    expect(title.textContent).toBe(subtitle.title);
    expect(title.classList.contains('line-clamp-2')).toBe(true);
    expect(card.classList.contains('shadow-sm')).toBe(false);

    const content = card.firstElementChild;
    expect(content?.classList.contains('gap-2')).toBe(true);
    expect(content?.classList.contains('p-2.5')).toBe(true);
    expect(content?.classList.contains('gap-2.5')).toBe(false);
    expect(content?.classList.contains('p-3')).toBe(false);

    expect(Array.from(header.children[1].children).map((item) => item.textContent)).toEqual([
      'english',
      'learning_subtitle',
      '· v2_local_subtitles_sync_value',
      '· v2_local_subtitles_added_date',
    ]);

    const previewButton = getButton(container, 'v2_local_subtitles_preview');
    expect(previewButton.classList.contains('w-full')).toBe(true);

    const roleLegend = card.querySelector('fieldset > legend');
    expect(roleLegend?.textContent).toBe('v2_local_subtitles_current_tab_use');
    expect(roleLegend?.classList.contains('sr-only')).toBe(true);
    expect(card.querySelector('fieldset > legend:not(.sr-only)')).toBeNull();

    const actionNames = Array.from(card.querySelectorAll('button')).map(getButtonName);
    expect(actionNames).toEqual([
      'v2_local_subtitles_preview',
      'learning_subtitle: v2_local_subtitles_default_short',
      'support_subtitle',
      'v2_local_subtitles_sync',
      'v2_local_subtitles_edit_details',
      'delete',
    ]);
    expect(getButton(container, 'learning_subtitle: v2_local_subtitles_default_short').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(getButton(container, 'support_subtitle').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps long identity and both selected-role semantics while one role is pending', () => {
    const longTitle =
      'A deliberately long registered subtitle title that must retain its two-line identity treatment';
    renderCard(root, {
      data: { ...subtitle, title: longTitle },
      isAvailable: true,
      isRoleAvailable: () => true,
      pendingRoles: { learning: true, support: false },
      tabInfo: {
        learningSubtitleId: SUBTITLE_ID,
        supportSubtitleId: SUBTITLE_ID,
      },
    });

    const card = container.querySelector('li');
    const title = card?.querySelector('h3');
    if (!(card instanceof HTMLLIElement) || !(title instanceof HTMLHeadingElement)) {
      throw new Error('Expected a compact selected subtitle card');
    }

    expect(title.textContent).toBe(longTitle);
    expect(title.classList.contains('line-clamp-2')).toBe(true);
    expect(card.getAttribute('aria-labelledby')).toBe(title.id);
    expect(card.getAttribute('aria-busy')).toBe('true');
    expect(card.classList.contains('border-primary/40')).toBe(true);
    expect(card.classList.contains('bg-primary/5')).toBe(true);

    const metadata = title.nextElementSibling;
    expect(Array.from(metadata?.children ?? []).map((item) => item.textContent)).toEqual([
      'english',
      'learning_subtitle',
      'support_subtitle',
      '· v2_local_subtitles_sync_value',
      '· v2_local_subtitles_added_date',
    ]);

    const pendingLearning = getButton(
      card,
      'learning_subtitle: v2_local_subtitles_applying'
    );
    const selectedSupport = getButton(
      card,
      'support_subtitle: v2_local_subtitles_default_short'
    );
    expect(pendingLearning.getAttribute('aria-pressed')).toBe('true');
    expect(pendingLearning.disabled).toBe(true);
    expect(selectedSupport.getAttribute('aria-pressed')).toBe('true');
    expect(selectedSupport.disabled).toBe(false);
    expect(getButton(card, 'v2_local_subtitles_preview').disabled).toBe(true);
    expect(getButton(card, 'v2_local_subtitles_sync').disabled).toBe(true);
    expect(getButton(card, 'v2_local_subtitles_edit_details').disabled).toBe(true);
    expect(getButton(card, 'delete').disabled).toBe(true);
  });

  it('preserves the existing pending-action policy and exposes pending state', () => {
    const onRoleChange = vi.fn();
    const availableOverrides = {
      isAvailable: true,
      isRoleAvailable: () => true,
      onRoleChange,
    };
    renderCard(root, availableOverrides);

    const learningButton = getButton(container, 'learning_subtitle');
    learningButton.focus();
    act(() => learningButton.click());
    expect(onRoleChange).toHaveBeenCalledWith('learning', SUBTITLE_ID);

    renderCard(root, {
      ...availableOverrides,
      pendingRoles: { learning: true, support: false },
    });

    const card = container.querySelector('li');
    const pendingLearningButton = getButton(
      container,
      'learning_subtitle: v2_local_subtitles_applying'
    );
    expect(card?.getAttribute('aria-busy')).toBe('true');
    expect(pendingLearningButton.disabled).toBe(true);
    expect(getButton(container, 'support_subtitle').disabled).toBe(false);
    expect(getButton(container, 'v2_local_subtitles_preview').disabled).toBe(true);
    expect(getButton(container, 'v2_local_subtitles_sync').disabled).toBe(true);
    expect(getButton(container, 'v2_local_subtitles_edit_details').disabled).toBe(true);
    expect(getButton(container, 'delete').disabled).toBe(true);
    expect(document.activeElement).toBe(pendingLearningButton);
  });

  it('restores focus to the utility action after cancel and successful submission', async () => {
    const onEdit = vi.fn().mockResolvedValue(undefined);
    const onUpdateDelay = vi.fn().mockResolvedValue(undefined);
    renderCard(root, { onEdit, onUpdateDelay });

    const syncButton = getButton(container, 'v2_local_subtitles_sync');
    act(() => syncButton.click());
    expect(document.activeElement?.textContent).toBe('v2_local_subtitles_sync_adjustment');
    act(() => getButton(container, 'cancel').click());
    expect(document.activeElement).toBe(getButton(container, 'v2_local_subtitles_sync'));

    act(() => getButton(container, 'v2_local_subtitles_sync').click());
    await act(async () => {
      getButton(container, 'save').click();
      await Promise.resolve();
    });
    expect(onUpdateDelay).toHaveBeenCalledWith(SUBTITLE_ID, 0);
    expect(document.activeElement).toBe(getButton(container, 'v2_local_subtitles_sync'));

    const editButton = getButton(container, 'v2_local_subtitles_edit_details');
    act(() => editButton.click());
    expect(document.activeElement?.textContent).toBe('v2_local_subtitles_edit_details');
    act(() => getButton(container, 'cancel').click());
    expect(document.activeElement).toBe(getButton(container, 'v2_local_subtitles_edit_details'));

    act(() => getButton(container, 'v2_local_subtitles_edit_details').click());
    await act(async () => {
      getButton(container, 'save').click();
      await Promise.resolve();
    });
    expect(onEdit).toHaveBeenCalledWith(SUBTITLE_ID, subtitle.title, subtitle.language);
    expect(document.activeElement).toBe(getButton(container, 'v2_local_subtitles_edit_details'));
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
    (candidate) => getButtonName(candidate) === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
};

const getButtonName = (button: HTMLButtonElement) =>
  button.getAttribute('aria-label') ?? button.textContent;
