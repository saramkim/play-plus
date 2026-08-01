import { Language } from '@utils/constants';
import { OpenSubtitlesContentType, OpenSubtitlesSearchQuery } from '@utils/opensubtitles/type';

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

export const buildOpenSubtitlesSearchQuery = (
  fields: OpenSubtitlesSearchFields,
  page = 1
): OpenSubtitlesSearchQuery => {
  const query = fields.query.trim();
  if (!query) throw new Error('OpenSubtitles search title is required');

  return {
    query,
    language: fields.language,
    ...(fields.contentType === 'all' ? {} : { contentType: fields.contentType }),
    ...(optionalPositiveInteger(fields.year) ? { year: optionalPositiveInteger(fields.year) } : {}),
    ...(optionalPositiveInteger(fields.seasonNumber)
      ? { seasonNumber: optionalPositiveInteger(fields.seasonNumber) }
      : {}),
    ...(optionalPositiveInteger(fields.episodeNumber)
      ? { episodeNumber: optionalPositiveInteger(fields.episodeNumber) }
      : {}),
    page,
  };
};
