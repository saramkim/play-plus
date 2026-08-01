import { SavedSubtitle, SavedSubtitleReviewStatus } from '@storage/type';

export const REVIEW_STATUS_FILTERS = ['all', 'new', 'learning', 'mastered'] as const;

export type ReviewStatusFilter = (typeof REVIEW_STATUS_FILTERS)[number];

export const isReviewStatusFilter = (value: string): value is ReviewStatusFilter => {
  return REVIEW_STATUS_FILTERS.some((filter) => filter === value);
};

export const filterSavedSubtitlesByReviewStatus = (
  subtitles: SavedSubtitle[],
  filter: ReviewStatusFilter
) => {
  if (filter === 'all') return subtitles;
  return subtitles.filter(({ reviewStatus }) => reviewStatus === filter);
};

export const isSavedSubtitleReviewStatus = (value: string): value is SavedSubtitleReviewStatus => {
  return value === 'new' || value === 'learning' || value === 'mastered';
};
