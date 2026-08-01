import { createSavedSubtitleCard } from '@storage/saved-subtitle';
import { SavedSubtitle, SavedSubtitleReviewStatus } from '@storage/type';
import { describe, expect, it } from 'vitest';

import { filterSavedSubtitlesByReviewStatus } from './review-status-filter';

const createCard = (
  id: string,
  reviewStatus: SavedSubtitleReviewStatus,
  text: string,
  savedAt: string
): SavedSubtitle => ({
  ...createSavedSubtitleCard(
    { primary: { text }, url: `https://example.com/${id}`, startTime: 1 },
    id,
    savedAt
  ),
  reviewStatus,
});

describe('review status filter', () => {
  const latestFirst = [
    createCard('saved-mastered', 'mastered', 'Matching latest', '2026-08-03T00:00:00.000Z'),
    createCard('saved-learning', 'learning', 'Matching older', '2026-08-02T00:00:00.000Z'),
  ];

  it('returns every card for all without changing the search and sort result order', () => {
    expect(filterSavedSubtitlesByReviewStatus(latestFirst, 'all')).toBe(latestFirst);
  });

  it('composes with an already searched and sorted list', () => {
    expect(filterSavedSubtitlesByReviewStatus(latestFirst, 'learning').map(({ id }) => id)).toEqual([
      'saved-learning',
    ]);
  });

  it('returns an empty result for a selected status with no matching cards', () => {
    expect(filterSavedSubtitlesByReviewStatus(latestFirst, 'new')).toEqual([]);
  });
});
