import { useRef, useState } from 'react';

import { Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';
import {
  OpenSubtitlesCandidate,
  OpenSubtitlesDownloadedSubtitle,
  OpenSubtitlesErrorCode,
  OpenSubtitlesSearchQuery,
  OpenSubtitlesSearchResult,
} from '@utils/opensubtitles/type';
import { LoaderCircleIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';

import { requestOpenSubtitlesPermission } from './open-subtitles-permission';
import { OpenSubtitlesResultCard } from './open-subtitles-result-card';
import {
  buildOpenSubtitlesSearchQuery,
  OpenSubtitlesContentTypeFilter,
  OpenSubtitlesSearchFields,
} from './open-subtitles-search-query';
import {
  registerSubtitleText,
  SubtitleRegistrationError,
  subtitleTitleFromFileName,
  SUPPORTED_SUBTITLE_EXTENSIONS,
} from './subtitle-registration';
import { LANGUAGE_OPTIONS } from './subtitle-uploader';

const DEFAULT_FIELDS: OpenSubtitlesSearchFields = {
  query: '',
  language: 'en',
  contentType: 'all',
  year: '',
  seasonNumber: '',
  episodeNumber: '',
};

const allowedExtensionsString = SUPPORTED_SUBTITLE_EXTENSIONS.map((extension) =>
  extension.replace('.', '').toUpperCase()
).join(', ');

const registrationErrorMessage = (error: unknown) => {
  if (error instanceof SubtitleRegistrationError) {
    return error.code === 'unsupported-file-type'
      ? t('error_unsupported_file_type', allowedExtensionsString)
      : t('error_empty_subtitle');
  }
  return t('error_try_later');
};

const successMessage = (downloaded: OpenSubtitlesDownloadedSubtitle) => {
  if (downloaded.fromCache) return t('success_add_subtitle_cached');
  if (typeof downloaded.quota?.remaining === 'number') {
    return t('success_add_subtitle_remaining', String(downloaded.quota.remaining));
  }
  return t('success_add_online_subtitle');
};

const openSubtitlesErrorMessage = (code: OpenSubtitlesErrorCode, operation: 'search' | 'download') => {
  switch (code) {
    case 'API_KEY_MISSING':
    case 'USER_AGENT_MISSING':
      return t('error_online_configuration');
    case 'INVALID_QUERY':
      return t('error_online_invalid_query');
    case 'AUTH_REQUIRED':
    case 'ACCESS_DENIED':
      return t('error_online_access');
    case 'DOWNLOAD_REJECTED':
      return t(operation === 'search' ? 'error_online_search' : 'error_online_download');
    case 'RATE_LIMIT':
      return t('error_online_rate_limit');
    case 'NETWORK':
      return t('error_online_network');
    case 'SERVER':
      return t('error_online_unavailable');
    case 'INVALID_RESPONSE':
      return t('error_online_response');
    case 'TEMPORARY_LINK_EXPIRED':
      return t('error_online_expired');
    case 'FILE_TOO_LARGE':
      return t('error_file_size');
    case 'DECODE_FAILED':
      return t('error_subtitle_decode');
    default:
      return t(operation === 'search' ? 'error_online_search' : 'error_online_download');
  }
};

export function OpenSubtitlesSearch({ onAdded }: { onAdded: () => void }) {
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [result, setResult] = useState<OpenSubtitlesSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectingFileId, setSelectingFileId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const lastSearchQuery = useRef<OpenSubtitlesSearchQuery | null>(null);

  const updateField = <Key extends keyof OpenSubtitlesSearchFields>(
    key: Key,
    value: OpenSubtitlesSearchFields[Key]
  ) => setFields((current) => ({ ...current, [key]: value }));

  const runSearch = async (page: number, append: boolean) => {
    const requestId = ++requestSequence.current;
    if (!append) {
      lastSearchQuery.current = null;
      setResult(null);
    }
    setSearching(true);
    setError(null);

    try {
      const query = append && lastSearchQuery.current
        ? { ...lastSearchQuery.current, page }
        : buildOpenSubtitlesSearchQuery(fields, page);
      const permissionGranted = await requestOpenSubtitlesPermission();
      if (requestId !== requestSequence.current) return;
      if (!permissionGranted) {
        setError(t('error_online_permission_denied'));
        return;
      }

      const response = await sendMessage('searchOpenSubtitles', query);
      if (requestId !== requestSequence.current) return;
      if (!response.success) {
        setError(openSubtitlesErrorMessage(response.code, 'search'));
        return;
      }
      if (!append) lastSearchQuery.current = query;

      setResult((current) => {
        if (!append || !current) return response.data;
        const candidates = [
          ...current.candidates,
          ...response.data.candidates.filter(
            (candidate) => !current.candidates.some((currentCandidate) => currentCandidate.fileId === candidate.fileId)
          ),
        ];
        return { ...response.data, candidates };
      });
    } catch {
      if (requestId === requestSequence.current) setError(t('error_online_search'));
    } finally {
      if (requestId === requestSequence.current) setSearching(false);
    }
  };

  const addCandidate = async (candidate: OpenSubtitlesCandidate) => {
    setSelectingFileId(candidate.fileId);
    setError(null);

    try {
      const response = await sendMessage('downloadOpenSubtitle', {
        fileId: candidate.fileId,
        language: candidate.language,
      });
      if (!response.success) {
        setError(openSubtitlesErrorMessage(response.code, 'download'));
        return;
      }

      const downloaded = response.data;
      await registerSubtitleText({
        fileName: downloaded.fileName,
        title: subtitleTitleFromFileName(downloaded.fileName || candidate.fileName),
        language: candidate.language,
        text: downloaded.text,
      });
      toast.success(successMessage(downloaded));
      onAdded();
    } catch (downloadError) {
      setError(
        downloadError instanceof SubtitleRegistrationError
          ? registrationErrorMessage(downloadError)
          : t('error_try_later')
      );
    } finally {
      setSelectingFileId(null);
    }
  };

  return (
    <div className='flex min-w-0 max-w-full flex-col gap-3 overflow-hidden rounded-md border p-3'>
      <form
        aria-label={t('online_subtitle_search')}
        aria-busy={searching}
        className='flex flex-col gap-2'
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(1, false);
        }}
      >
        <label className='flex flex-col gap-1 text-[12px] font-medium'>
          {t('search_title')}
          <Input
            aria-label={t('search_title')}
            value={fields.query}
            onChange={(event) => updateField('query', event.currentTarget.value)}
            required
          />
        </label>

        <div className='grid grid-cols-2 gap-2'>
          <label className='flex min-w-0 flex-col gap-1 text-[12px] font-medium'>
            {t('language')}
            <Select value={fields.language} onValueChange={(value) => updateField('language', value as Language)}>
              <SelectTrigger aria-label={t('language')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className='flex min-w-0 flex-col gap-1 text-[12px] font-medium'>
            {t('content_type')}
            <Select
              value={fields.contentType}
              onValueChange={(value) => updateField('contentType', value as OpenSubtitlesContentTypeFilter)}
            >
              <SelectTrigger aria-label={t('content_type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>{t('content_type_all')}</SelectItem>
                <SelectItem value='movie'>{t('content_type_movie')}</SelectItem>
                <SelectItem value='episode'>{t('content_type_episode')}</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>

        <div className='grid grid-cols-3 gap-2'>
          <NumberFilter
            label={t('year')}
            min={1888}
            value={fields.year}
            onChange={(value) => updateField('year', value)}
          />
          <NumberFilter
            label={t('season')}
            min={1}
            value={fields.seasonNumber}
            onChange={(value) => updateField('seasonNumber', value)}
          />
          <NumberFilter
            label={t('episode')}
            min={1}
            value={fields.episodeNumber}
            onChange={(value) => updateField('episodeNumber', value)}
          />
        </div>

        <Button type='submit' size='sm' disabled={searching || !fields.query.trim()}>
          {searching ? <LoaderCircleIcon className='animate-spin' /> : <SearchIcon />}
          {t(searching ? 'searching' : 'search')}
        </Button>
      </form>

      {error && (
        <p
          role='alert'
          className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-wrap text-[13px] text-destructive'
        >
          {error}
        </p>
      )}

      {result && result.candidates.length === 0 && (
        <p role='status' className='rounded-md bg-gray-100 px-3 py-2 text-wrap text-[13px] text-gray-600'>
          {t('no_search_results')}
        </p>
      )}

      {result && result.candidates.length > 0 && (
        <div className='flex min-w-0 flex-col gap-2'>
          <p role='status' className='text-wrap text-[12px] text-gray-500'>
            {t('search_result_summary', String(result.candidates.length), String(result.totalCount))}
          </p>
          {result.candidates.map((candidate) => (
            <OpenSubtitlesResultCard
              key={candidate.fileId}
              candidate={candidate}
              disabled={selectingFileId !== null}
              adding={selectingFileId === candidate.fileId}
              onAdd={() => void addCandidate(candidate)}
            />
          ))}
          {result.page < result.totalPages && (
            <Button variant='outline' size='sm' type='button' disabled={searching} onClick={() => void runSearch(result.page + 1, true)}>
              {searching && <LoaderCircleIcon className='animate-spin' />}
              {t(searching ? 'loading_more' : 'show_more')}
            </Button>
          )}
        </div>
      )}

      <p className='text-wrap text-[11px] text-gray-500'>
        {t('opensubtitles_attribution')}{' '}
        <a className='underline' href='https://www.opensubtitles.com' target='_blank' rel='noreferrer'>
          OpenSubtitles
        </a>
      </p>
    </div>
  );
}

function NumberFilter({
  label,
  min,
  value,
  onChange,
}: {
  label: string;
  min: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className='flex min-w-0 flex-col gap-1 text-[12px] font-medium'>
      {label}
      <Input
        aria-label={label}
        className='px-2'
        type='number'
        min={min}
        step={1}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
