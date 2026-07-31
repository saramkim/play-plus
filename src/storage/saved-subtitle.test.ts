import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildSavedSubtitleDraft,
  createSavedSubtitleCard,
  findSavedSubtitleCard,
  getSavedSubtitleCards,
  getSavedSubtitleSearchText,
  migrateSavedSubtitles,
  removeSavedSubtitleById,
  restoreSavedSubtitleAt,
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
      { id: 'saved-legacy-1', primary: { text: 'Same' }, url: URL, startTime: 1, savedAt: SAVED_AT },
      { id: 'saved-legacy-2', primary: { text: 'Same' }, url: URL, startTime: 1, savedAt: SAVED_AT },
    ]);
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
});

describe('saved subtitle identity and list operations', () => {
  const draft = buildSavedSubtitleDraft({
    primary: { text: 'Hello', language: 'en' },
    secondary: { text: '안녕하세요', language: 'ko' },
    url: URL,
    startTime: 1,
  });
  const card = createSavedSubtitleCard(draft, 'saved-card-1', SAVED_AT);

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
});
