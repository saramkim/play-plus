import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addSavedSubtitleCard,
  buildSavedSubtitleDraft,
  createSavedSubtitleCard,
  deleteSavedSubtitleCard,
  findSavedSubtitleCard,
  getSavedSubtitleCards,
  getSavedSubtitleSearchText,
  migrateSavedSubtitles,
  removeSavedSubtitleById,
  restoreSavedSubtitleCard,
  restoreSavedSubtitleAt,
  setSavedSubtitleReviewStatus,
  updateSavedSubtitleReviewStatus,
} from './saved-subtitle';

const URL = 'https://www.coupangplay.com/play/example';
const SAVED_AT = '2026-08-01T00:00:00.000Z';
let localStorage: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage = {};
  vi.mocked(chrome.storage.local.get).mockImplementation(((key: string, callback: (items: object) => void) => {
    callback(key in localStorage ? { [key]: localStorage[key] } : {});
  }) as typeof chrome.storage.local.get);
  vi.mocked(chrome.storage.local.set).mockImplementation(async (items) => {
    Object.assign(localStorage, items);
  });
});

describe('saved subtitle card builder', () => {
  it('keeps primary and secondary role snapshots', () => {
    expect(
      buildSavedSubtitleDraft({
        primary: { text: 'Hello', language: 'en' },
        secondary: { text: '안녕하세요', language: 'ko' },
        url: URL,
        startTime: 1,
      })
    ).toEqual({
      primary: { text: 'Hello', language: 'en' },
      secondary: { text: '안녕하세요', language: 'ko' },
      url: URL,
      startTime: 1,
    });
  });

  it('promotes a secondary-only snapshot to the required primary line', () => {
    expect(
      buildSavedSubtitleDraft({ secondary: { text: '안녕하세요', language: 'ko' }, url: URL, startTime: 2 })
    ).toEqual({
      primary: { text: '안녕하세요', language: 'ko' },
      secondary: undefined,
      url: URL,
      startTime: 2,
    });
  });

  it('rejects an empty snapshot', () => {
    expect(() => buildSavedSubtitleDraft({ url: URL, startTime: 0 })).toThrow();
  });
});

describe('saved subtitle migration', () => {
  it('preserves duplicate legacy entries while assigning distinct ids', () => {
    const legacy = { content: 'Same', url: URL, startTime: 1, savedAt: SAVED_AT };
    const ids = ['saved-legacy-1', 'saved-legacy-2'];

    const result = migrateSavedSubtitles([legacy, legacy], () => ids.shift()!);

    expect(result.migrated).toBe(true);
    expect(result.cards).toEqual([
      {
        id: 'saved-legacy-1',
        primary: { text: 'Same' },
        reviewStatus: 'new',
        url: URL,
        startTime: 1,
        savedAt: SAVED_AT,
      },
      {
        id: 'saved-legacy-2',
        primary: { text: 'Same' },
        reviewStatus: 'new',
        url: URL,
        startTime: 1,
        savedAt: SAVED_AT,
      },
    ]);
  });

  it('adds new to a stable-id card without changing its id or content', () => {
    const previous = {
      id: 'saved-existing',
      primary: { text: 'Existing', language: 'en' as const },
      secondary: { text: '기존', language: 'ko' as const },
      url: URL,
      startTime: 2,
      savedAt: SAVED_AT,
    };

    expect(migrateSavedSubtitles([previous])).toEqual({
      cards: [{ ...previous, reviewStatus: 'new' }],
      migrated: true,
    });
  });

  it('persists the default status once for a stable-id card from the previous schema', async () => {
    localStorage.savedSubtitles = [
      { id: 'saved-existing', primary: { text: 'Existing' }, url: URL, startTime: 2, savedAt: SAVED_AT },
    ];

    const first = await getSavedSubtitleCards();
    const second = await getSavedSubtitleCards();

    expect(first).toEqual(second);
    expect(second[0]).toMatchObject({ id: 'saved-existing', reviewStatus: 'new' });
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });

  it('persists generated ids once and reuses them on the next read', async () => {
    localStorage.savedSubtitles = [{ content: 'Legacy', url: URL, startTime: 1, savedAt: SAVED_AT }];

    const first = await getSavedSubtitleCards(() => 'saved-persisted');
    const second = await getSavedSubtitleCards(() => {
      throw new Error('must not regenerate');
    });

    expect(first).toEqual(second);
    expect(second[0].id).toBe('saved-persisted');
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
  });

  it('generates the same migration ids in independent contexts', () => {
    const legacy = [{ content: 'Legacy', url: URL, startTime: 1, savedAt: SAVED_AT }];

    expect(migrateSavedSubtitles(legacy).cards).toEqual(migrateSavedSubtitles(legacy).cards);
  });

  it('does not rewrite invalid stored data', async () => {
    localStorage.savedSubtitles = [{ content: 'Missing source fields' }];

    await expect(getSavedSubtitleCards()).rejects.toThrow();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('rejects an invalid persisted review status without rewriting it', async () => {
    localStorage.savedSubtitles = [
      {
        id: 'saved-invalid-status',
        primary: { text: 'Invalid' },
        reviewStatus: 'scheduled',
        url: URL,
        startTime: 1,
        savedAt: SAVED_AT,
      },
    ];

    await expect(getSavedSubtitleCards()).rejects.toThrow();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('saved subtitle identity and list operations', () => {
  const draft = buildSavedSubtitleDraft({
    primary: { text: 'Hello', language: 'en' },
    secondary: { text: '안녕하세요', language: 'ko' },
    url: URL,
    startTime: 1,
  });
  const card = createSavedSubtitleCard(draft, 'saved-card-1', SAVED_AT);

  it('defaults a newly created card to new', () => {
    expect(card.reviewStatus).toBe('new');
  });

  it('matches exact source, cue, role text, and language only', () => {
    expect(findSavedSubtitleCard([card], draft)?.id).toBe(card.id);
    expect(findSavedSubtitleCard([card], { ...draft, startTime: 2 })).toBeUndefined();
    expect(
      findSavedSubtitleCard([card], { ...draft, primary: { ...draft.primary, language: 'ko' } })
    ).toBeUndefined();
  });

  it('searches both stored lines', () => {
    expect(getSavedSubtitleSearchText(card)).toContain('Hello');
    expect(getSavedSubtitleSearchText(card)).toContain('안녕하세요');
  });

  it('deletes and restores one card by stable id without affecting equal text in another card', () => {
    const other = createSavedSubtitleCard({ ...draft, startTime: 2 }, 'saved-card-2', SAVED_AT);
    const removed = removeSavedSubtitleById([card, other], card.id);

    expect(removed.cards).toEqual([other]);
    expect(restoreSavedSubtitleAt(removed.cards, removed.removed!, removed.index)).toEqual([card, other]);
  });

  it('moves one stable-id card through every review state without changing other fields', () => {
    const other = createSavedSubtitleCard(draft, 'saved-card-2', SAVED_AT);
    const learning = setSavedSubtitleReviewStatus([card, other], card.id, 'learning');
    const mastered = setSavedSubtitleReviewStatus(learning, card.id, 'mastered');
    const reset = setSavedSubtitleReviewStatus(mastered, card.id, 'new');

    expect(learning[0]).toEqual({ ...card, reviewStatus: 'learning' });
    expect(mastered[0]).toEqual({ ...card, reviewStatus: 'mastered' });
    expect(reset).toEqual([card, other]);
    expect(learning[1]).toBe(other);
  });

  it('updates status from the latest stored cards and preserves equal-text siblings', async () => {
    const other = createSavedSubtitleCard(draft, 'saved-card-2', SAVED_AT);
    localStorage.savedSubtitles = [card, other];

    await updateSavedSubtitleReviewStatus(other.id, 'learning');

    expect(localStorage.savedSubtitles).toEqual([card, { ...other, reviewStatus: 'learning' }]);
  });

  it('restores the deleted card with its previous review status', () => {
    const learning = setSavedSubtitleReviewStatus([card], card.id, 'learning')[0];
    const removed = removeSavedSubtitleById([learning], learning.id);

    expect(restoreSavedSubtitleAt(removed.cards, removed.removed!, removed.index)).toEqual([learning]);
  });
});

describe('saved subtitle persisted mutations', () => {
  const draft = buildSavedSubtitleDraft({
    primary: { text: 'Hello', language: 'en' },
    secondary: { text: '안녕하세요', language: 'ko' },
    url: URL,
    startTime: 1,
  });
  const first = createSavedSubtitleCard(draft, 'saved-card-1', SAVED_AT);
  const second = createSavedSubtitleCard({ ...draft, startTime: 2 }, 'saved-card-2', SAVED_AT);

  it('adds a card without dropping the latest persisted cards', async () => {
    localStorage.savedSubtitles = [second];

    const added = await addSavedSubtitleCard(draft);

    expect(added).toBeDefined();
    expect(localStorage.savedSubtitles).toEqual([added, second]);
  });

  it('does not write an exact duplicate draft', async () => {
    localStorage.savedSubtitles = [first];

    await expect(addSavedSubtitleCard(draft)).resolves.toBeUndefined();

    expect(localStorage.savedSubtitles).toEqual([first]);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('deletes by stable id from the latest persisted cards', async () => {
    localStorage.savedSubtitles = [first, second];

    await expect(deleteSavedSubtitleCard(first.id)).resolves.toEqual({ card: first, index: 0 });

    expect(localStorage.savedSubtitles).toEqual([second]);
  });

  it('does not write when the card to delete is missing', async () => {
    localStorage.savedSubtitles = [second];

    await expect(deleteSavedSubtitleCard(first.id)).resolves.toBeUndefined();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('restores into the latest persisted cards without dropping a later write', async () => {
    const learning = setSavedSubtitleReviewStatus([first], first.id, 'learning')[0];
    const after = createSavedSubtitleCard({ ...draft, startTime: 3 }, 'saved-card-3', SAVED_AT);
    localStorage.savedSubtitles = [second, learning, after];
    const deletion = await deleteSavedSubtitleCard(learning.id);
    const later = createSavedSubtitleCard({ ...draft, startTime: 4 }, 'saved-card-4', SAVED_AT);
    localStorage.savedSubtitles = [second, after, later];
    vi.mocked(chrome.storage.local.set).mockClear();

    await expect(restoreSavedSubtitleCard(deletion!)).resolves.toEqual(learning);

    expect(deletion).toEqual({ card: learning, index: 1 });
    expect(localStorage.savedSubtitles).toEqual([second, learning, after, later]);
    expect(chrome.storage.local.set).toHaveBeenCalledOnce();
  });

  it('does not overwrite a newer card when the deleted card id already exists', async () => {
    const mastered = setSavedSubtitleReviewStatus([first], first.id, 'mastered')[0];
    localStorage.savedSubtitles = [mastered, second];

    await expect(restoreSavedSubtitleCard({ card: first, index: 0 })).resolves.toBeUndefined();

    expect(localStorage.savedSubtitles).toEqual([mastered, second]);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
