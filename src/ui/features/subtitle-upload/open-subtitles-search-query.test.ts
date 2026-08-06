import { describe, expect, it } from 'vitest';

import {
  buildOpenSubtitlesSearchQuery,
  countAppliedOpenSubtitlesFilters,
  OpenSubtitlesSearchFields,
} from './open-subtitles-search-query';

const fields: OpenSubtitlesSearchFields = {
  query: ' The Matrix ',
  language: 'en',
  contentType: 'movie',
  year: '1999',
  seasonNumber: '',
  episodeNumber: '',
};

describe('OpenSubtitles search query', () => {
  it('trims the title and includes valid user-selected filters', () => {
    expect(buildOpenSubtitlesSearchQuery(fields)).toEqual({
      query: 'The Matrix',
      language: 'en',
      contentType: 'movie',
      year: 1999,
      page: 1,
    });
  });

  it('omits all and invalid optional values', () => {
    expect(
      buildOpenSubtitlesSearchQuery({
        ...fields,
        contentType: 'all',
        year: 'not-a-year',
        seasonNumber: '0',
        episodeNumber: '2.5',
      })
    ).toEqual({ query: 'The Matrix', language: 'en', page: 1 });
  });

  it('requires a non-blank explicit title', () => {
    expect(() => buildOpenSubtitlesSearchQuery({ ...fields, query: '  ' })).toThrow(
      'OpenSubtitles search title is required'
    );
  });

  it('counts only effective advanced filters', () => {
    expect(countAppliedOpenSubtitlesFilters(fields)).toBe(2);
    expect(
      countAppliedOpenSubtitlesFilters({
        ...fields,
        contentType: 'all',
        year: 'not-a-year',
        seasonNumber: '0',
        episodeNumber: '3',
      })
    ).toBe(1);
  });
});
