import { Language } from '@utils/constants';
import {
  OpenSubtitlesContentType,
  OpenSubtitlesSearchQuery,
} from '@utils/opensubtitles/type';

export type OpenSubtitlesContentTypeFilter = 'all' | OpenSubtitlesContentType;

export interface OpenSubtitlesSearchFields {
  query: string;
  language: Language;
  contentType: OpenSubtitlesContentTypeFilter;
  year: string;
  seasonNumber: string;
  episodeNumber: string;
}

const optionalPositiveInteger = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const countAppliedOpenSubtitlesFilters = (fields: OpenSubtitlesSearchFields) => {
  const numericFilters = [fields.year, fields.seasonNumber, fields.episodeNumber];

  return (
    (fields.contentType === 'all' ? 0 : 1) +
    numericFilters.filter((value) => optionalPositiveInteger(value) !== undefined).length
  );
};

export const buildOpenSubtitlesSearchQuery = (
  fields: OpenSubtitlesSearchFields,
  page = 1
): OpenSubtitlesSearchQuery => {
  const query = fields.query.trim();
  if (!query) throw new Error('OpenSubtitles search title is required');

  const year = optionalPositiveInteger(fields.year);
  const seasonNumber = optionalPositiveInteger(fields.seasonNumber);
  const episodeNumber = optionalPositiveInteger(fields.episodeNumber);

  return {
    query,
    language: fields.language,
    ...(fields.contentType === 'all' ? {} : { contentType: fields.contentType }),
    ...(year === undefined ? {} : { year }),
    ...(seasonNumber === undefined ? {} : { seasonNumber }),
    ...(episodeNumber === undefined ? {} : { episodeNumber }),
    page,
  };
};
