import { act, useEffect } from 'react';

import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import type { LearningCard } from '@storage/v2/type';
import type { Language } from '@utils/constants';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SubtitleOverviewRow } from './subtitle-overview-model';
import {
  createSubtitleOverviewSavedCueIndex,
  isSubtitleOverviewRowSaved,
  useSubtitleOverviewSavedState,
} from './subtitle-overview-saved-state';

const VIDEO_ID = '123e4567-e89b-12d3-a456-426614174000';
const OTHER_VIDEO_ID = '223e4567-e89b-12d3-a456-426614174000';
const VIDEO_URL = `https://www.coupangplay.com/play/${VIDEO_ID}?from=library`;
const OTHER_VIDEO_URL = `https://www.coupangplay.com/play/${OTHER_VIDEO_ID}`;
const context = { learningLanguage: 'en' as const, videoId: VIDEO_ID };

const learningRow = (overrides: Partial<SubtitleOverviewRow['cue']> = {}): SubtitleOverviewRow => ({
  anchorRole: 'learning',
  cue: {
    sourceIndex: 4,
    startTime: 1.00049,
    endTime: 2.00049,
    text: 'Hello & goodbye',
    ...overrides,
  },
  key: 'learning:4',
  learningSourceIndex: 4,
});

const supportRow: SubtitleOverviewRow = {
  anchorRole: 'support',
  cue: {
    sourceIndex: 8,
    startTime: 1.00049,
    endTime: 2.00049,
    text: 'Hello & goodbye',
  },
  key: 'support:8',
};

const assignedCard = ({
  endTime = 2.0004,
  id = 'matched',
  language = 'en',
  startTime = 1.0004,
  text = '<i>Hello &amp; goodbye</i>',
  url = VIDEO_URL,
}: {
  endTime?: number | null;
  id?: string;
  language?: Language;
  startTime?: number;
  text?: string;
  url?: string;
} = {}): LearningCard => ({
  id: `card-${id}`,
  content: {
    learning: { language, text },
    support: { language: 'ko', text: `support-${id}` },
  },
  source: {
    url,
    startTime,
    ...(endTime === null ? {} : { endTime }),
  },
  studyState: 'active',
  createdAt: '2026-08-07T00:00:00.000Z',
});

const unassignedCard = (): LearningCard => ({
  id: 'card-unassigned',
  content: { unassigned: { language: 'und', text: 'Hello & goodbye' } },
  source: { url: VIDEO_URL, startTime: 1.0004, endTime: 2.0004 },
  studyState: 'active',
  createdAt: '2026-08-07T00:00:00.000Z',
});

describe('subtitle overview saved cue index', () => {
  it('matches assigned learning cards by video, language, shared plain text, and rounded ms', () => {
    const index = createSubtitleOverviewSavedCueIndex([assignedCard()], context);

    expect(isSubtitleOverviewRowSaved(index, learningRow(), context)).toBe(true);
    expect(isSubtitleOverviewRowSaved(index, supportRow, context)).toBe(false);
  });

  it.each([
    ['video', assignedCard({ url: OTHER_VIDEO_URL })],
    ['language', assignedCard({ language: 'fr' })],
    ['text', assignedCard({ text: 'Different sentence' })],
    ['start time', assignedCard({ startTime: 1.001 })],
    ['end time', assignedCard({ endTime: 2.001 })],
  ])('does not match a different %s', (_difference, card) => {
    const index = createSubtitleOverviewSavedCueIndex([card], context);

    expect(isSubtitleOverviewRowSaved(index, learningRow(), context)).toBe(false);
  });

  it('requires an end time and ignores unassigned cards', () => {
    const index = createSubtitleOverviewSavedCueIndex(
      [assignedCard({ endTime: null, id: 'no-end' }), unassignedCard()],
      context
    );

    expect(index.size).toBe(0);
    expect(isSubtitleOverviewRowSaved(index, learningRow(), context)).toBe(false);
  });

  it('collapses duplicates to a boolean marker and ignores support differences', () => {
    const index = createSubtitleOverviewSavedCueIndex(
      [assignedCard({ id: 'first' }), assignedCard({ id: 'second' })],
      context
    );

    expect(index.size).toBe(1);
    expect(isSubtitleOverviewRowSaved(index, learningRow(), context)).toBe(true);
  });

  it('fails closed without a current video identity', () => {
    const missingIdentity = { ...context, videoId: null };
    const index = createSubtitleOverviewSavedCueIndex([assignedCard()], missingIdentity);

    expect(index.size).toBe(0);
    expect(isSubtitleOverviewRowSaved(index, learningRow(), missingIdentity)).toBe(false);
  });
});

describe('subtitle overview saved state', () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: ReturnType<typeof useSubtitleOverviewSavedState> | undefined;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    state = undefined;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('ignores an older load that resolves after the latest revision', async () => {
    const first = deferred<LearningCard[]>();
    const second = deferred<LearningCard[]>();
    const storage = createStorage([first.promise, second.promise]);

    await renderHarness(root, storage, 0, (next) => {
      state = next;
    });
    await renderHarness(root, storage, 1, (next) => {
      state = next;
    });
    await act(async () => second.resolve([assignedCard()]));
    expect(state?.isSaved(learningRow())).toBe(true);

    await act(async () => first.resolve([]));
    expect(state?.isSaved(learningRow())).toBe(true);
  });

  it('fails closed on a read error and recovers on the next revision', async () => {
    const storage = createStorage([
      Promise.reject(new Error('private read detail')),
      Promise.resolve([assignedCard()]),
    ]);

    await renderHarness(root, storage, 0, (next) => {
      state = next;
    });
    await flushPromises();
    expect(state?.isSaved(learningRow())).toBe(false);

    await renderHarness(root, storage, 1, (next) => {
      state = next;
    });
    await flushPromises();
    expect(state?.isSaved(learningRow())).toBe(true);
  });

  it('clears an optimistic marker when the next revision cannot be read', async () => {
    const failedRevision = deferred<LearningCard[]>();
    const storage = createStorage([Promise.resolve([]), failedRevision.promise]);

    await renderHarness(root, storage, 0, (next) => {
      state = next;
    });
    await flushPromises();
    act(() => state?.markSaved(learningRow()));
    expect(state?.isSaved(learningRow())).toBe(true);

    await renderHarness(root, storage, 1, (next) => {
      state = next;
    });
    await act(async () => failedRevision.reject(new Error('private revision read detail')));
    expect(state?.isSaved(learningRow())).toBe(false);
  });

  it('does not resurrect a marker from a save callback captured before a failed revision', async () => {
    const failedRevision = deferred<LearningCard[]>();
    const storage = createStorage([Promise.resolve([]), failedRevision.promise]);

    await renderHarness(root, storage, 0, (next) => {
      state = next;
    });
    await flushPromises();
    const staleMarkSaved = state?.markSaved;

    await renderHarness(root, storage, 1, (next) => {
      state = next;
    });
    await act(async () => failedRevision.reject(new Error('private revision read detail')));
    act(() => staleMarkSaved?.(learningRow()));

    expect(state?.isSaved(learningRow())).toBe(false);
  });

  it('keeps a successful optimistic marker until a later revision reconciles it', async () => {
    const initial = deferred<LearningCard[]>();
    const storage = createStorage([
      initial.promise,
      Promise.resolve([assignedCard()]),
      Promise.resolve([]),
    ]);

    await renderHarness(root, storage, 0, (next) => {
      state = next;
    });
    act(() => state?.markSaved(learningRow()));
    expect(state?.isSaved(learningRow())).toBe(true);

    await act(async () => initial.resolve([]));
    expect(state?.isSaved(learningRow())).toBe(true);

    await renderHarness(root, storage, 1, (next) => {
      state = next;
    });
    await flushPromises();
    expect(state?.isSaved(learningRow())).toBe(true);

    await renderHarness(root, storage, 2, (next) => {
      state = next;
    });
    await flushPromises();
    expect(state?.isSaved(learningRow())).toBe(false);
  });
});

function SavedStateHarness({
  onState,
  revision,
  storage,
}: {
  onState: (state: ReturnType<typeof useSubtitleOverviewSavedState>) => void;
  revision: number;
  storage: Pick<V2LearningCardStorageApi, 'get'>;
}) {
  const state = useSubtitleOverviewSavedState({
    cardRevision: revision,
    learningLanguage: context.learningLanguage,
    storage,
    videoId: context.videoId,
  });

  useEffect(() => onState(state), [onState, state]);
  return null;
}

async function renderHarness(
  root: Root,
  storage: Pick<V2LearningCardStorageApi, 'get'>,
  revision: number,
  onState: (state: ReturnType<typeof useSubtitleOverviewSavedState>) => void
) {
  await act(async () => {
    root.render(<SavedStateHarness onState={onState} revision={revision} storage={storage} />);
  });
}

const createStorage = (responses: Array<Promise<LearningCard[]>>) => ({
  get: vi.fn(() => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected learning-card read');
    return response;
  }),
});

const flushPromises = async () => {
  await act(async () => Promise.resolve());
};

const deferred = <T,>() => {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
};
