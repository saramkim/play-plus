import { act } from 'react';

import type { SubtitleId } from '@storage/subtitle';
import type { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubtitleRoleSummary } from './subtitle-role-summary';

const LEARNING_SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001' as SubtitleId;
const SUPPORT_SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000002' as SubtitleId;
const MISSING_SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000003' as SubtitleId;
const LONG_TITLE = 'A selected subtitle title that remains available in full even when the compact row truncates it';

const subtitles: V2RegisteredSubtitleMetadata[] = [
  {
    id: LEARNING_SUBTITLE_ID,
    title: LONG_TITLE,
    language: 'en',
    savedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: SUPPORT_SUBTITLE_ID,
    title: 'Support source',
    language: 'ko',
    savedAt: '2026-08-02T00:00:00.000Z',
  },
];

const learningProfile = {
  learningLanguage: 'en' as const,
  supportLanguage: 'ko' as const,
};

describe('SubtitleRoleSummary', () => {
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

  it('keeps long selected titles available in compact semantic rows', () => {
    renderSummary(root, {
      tabInfo: {
        learningSubtitleId: LEARNING_SUBTITLE_ID,
        supportSubtitleId: SUPPORT_SUBTITLE_ID,
      },
    });

    const section = container.querySelector('section');
    const list = section?.querySelector('dl');
    const learningRow = getRoleRow(container, 'learning');
    const value = learningRow.querySelector<HTMLElement>('[id$="-value"]');

    expect(section?.classList.contains('shrink-0')).toBe(true);
    expect(list).not.toBeNull();
    expect(learningRow.classList.contains('gap-1.5')).toBe(true);
    expect(learningRow.classList.contains('py-1')).toBe(true);
    expect(learningRow.classList.contains('gap-2')).toBe(false);
    expect(learningRow.classList.contains('py-1.5')).toBe(false);
    expect(value?.classList.contains('truncate')).toBe(true);
    expect(value?.getAttribute('title')).toBe(LONG_TITLE);
    expect(value?.textContent).toBe(`${LONG_TITLE} · english`);
  });

  it('isolates pending state and actions to the affected role row', () => {
    renderSummary(root, {
      tabInfo: {
        learningSubtitleId: LEARNING_SUBTITLE_ID,
        supportSubtitleId: SUPPORT_SUBTITLE_ID,
      },
      pendingRoles: { learning: true, support: false },
    });

    const learningRow = getRoleRow(container, 'learning');
    const supportRow = getRoleRow(container, 'support');
    const learningAction = getButton(learningRow, 'learning_subtitle: v2_local_subtitles_default_short');
    const supportAction = getButton(supportRow, 'support_subtitle: v2_local_subtitles_default_short');

    expect(learningRow.getAttribute('aria-busy')).toBe('true');
    expect(supportRow.hasAttribute('aria-busy')).toBe(false);
    expect(learningAction.disabled).toBe(true);
    expect(learningAction.textContent).toBe('v2_local_subtitles_applying');
    expect(supportAction.disabled).toBe(false);
    expect(supportAction.textContent).toBe('v2_local_subtitles_default_short');
  });

  it('reports default, not-configured, and missing selections truthfully', () => {
    renderSummary(root, {
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      tabInfo: null,
    });

    expect(getRoleValue(container, 'learning').textContent).toBe('v2_local_subtitles_default · english');
    expect(getRoleValue(container, 'support').textContent).toBe('v2_local_subtitles_not_configured');
    expect(container.querySelectorAll('button')).toHaveLength(0);

    renderSummary(root, {
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      tabInfo: { learningSubtitleId: MISSING_SUBTITLE_ID },
    });

    const missingValue = getRoleValue(container, 'learning');
    expect(missingValue.textContent).toBe('v2_local_subtitles_selected_missing · english');
    expect(missingValue.getAttribute('title')).toBe('v2_local_subtitles_selected_missing');
    expect(getButton(container, 'learning_subtitle: v2_local_subtitles_default_short')).toBeDefined();
  });

  it('returns focus to the role row only after a successful default action', async () => {
    const onReturnToDefault = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    renderSummary(root, {
      tabInfo: { learningSubtitleId: LEARNING_SUBTITLE_ID },
      onReturnToDefault,
    });

    const learningRow = getRoleRow(container, 'learning');
    const action = getButton(learningRow, 'learning_subtitle: v2_local_subtitles_default_short');
    const outsideButton = document.createElement('button');
    document.body.append(outsideButton);
    outsideButton.focus();

    await act(async () => action.click());
    expect(onReturnToDefault).toHaveBeenNthCalledWith(1, 'learning', LEARNING_SUBTITLE_ID);
    expect(document.activeElement).not.toBe(learningRow);

    outsideButton.focus();
    await act(async () => action.click());
    expect(onReturnToDefault).toHaveBeenNthCalledWith(2, 'learning', LEARNING_SUBTITLE_ID);
    expect(document.activeElement).toBe(learningRow);

    outsideButton.remove();
  });
});

function renderSummary(
  root: Root,
  overrides: Partial<React.ComponentProps<typeof SubtitleRoleSummary>> = {}
) {
  act(() =>
    root.render(
      <SubtitleRoleSummary
        subtitles={subtitles}
        tabInfo={null}
        learningProfile={learningProfile}
        isAvailable
        pendingRoles={{ learning: false, support: false }}
        onReturnToDefault={async () => true}
        {...overrides}
      />
    )
  );
}

function getRoleRow(container: HTMLElement, role: 'learning' | 'support') {
  const row = container.querySelector<HTMLElement>(`[data-subtitle-role='${role}']`);
  if (!row) throw new Error(`Expected ${role} role row`);
  return row;
}

function getRoleValue(container: HTMLElement, role: 'learning' | 'support') {
  const value = getRoleRow(container, role).querySelector<HTMLElement>('[id$="-value"]');
  if (!value) throw new Error(`Expected ${role} role value`);
  return value;
}

function getButton(container: HTMLElement, accessibleName: string) {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent) === accessibleName
  );
  if (!button) throw new Error(`Expected button: ${accessibleName}`);
  return button;
}
