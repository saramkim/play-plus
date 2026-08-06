import { t } from '@utils/i18n';
import { OpenSubtitlesCandidate } from '@utils/opensubtitles/type';
import { DownloadIcon, LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';

const fpsFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });
const ratingFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });

const formatUploadDate = (value: string | undefined) => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
};

function ResultBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'warning' | 'trusted';
}) {
  const toneClass = {
    neutral: 'border-gray-200 bg-gray-50 text-gray-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    trusted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[tone];
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${toneClass}`}>{children}</span>;
}

export function OpenSubtitlesResultCard({
  candidate,
  disabled,
  adding,
  onAdd,
}: {
  candidate: OpenSubtitlesCandidate;
  disabled: boolean;
  adding: boolean;
  onAdd: () => void;
}) {
  const primaryTitle = candidate.release?.trim() || candidate.fileName;
  const feature = [
    candidate.featureTitle,
    candidate.featureYear,
    candidate.seasonNumber ? `S${String(candidate.seasonNumber).padStart(2, '0')}` : null,
    candidate.episodeNumber ? `E${String(candidate.episodeNumber).padStart(2, '0')}` : null,
  ].filter(Boolean);
  const compatibility = [
    candidate.fps && candidate.fps > 0 ? `${fpsFormatter.format(candidate.fps)} FPS` : null,
    candidate.discCount && candidate.discCount > 1 && candidate.discNumber
      ? t('result_disc', String(candidate.discNumber), String(candidate.discCount))
      : null,
  ].filter(Boolean);
  const rating =
    candidate.rating && candidate.rating > 0 && candidate.votes && candidate.votes > 0
      ? t('result_rating', ratingFormatter.format(candidate.rating), integerFormatter.format(candidate.votes))
      : null;
  const downloads =
    candidate.downloadCount && candidate.downloadCount > 0
      ? t('result_downloads', integerFormatter.format(candidate.downloadCount))
      : null;
  const uploadDate = formatUploadDate(candidate.uploadDate);

  return (
    <article
      data-online-subtitle-result
      className='flex min-w-0 max-w-full flex-col gap-2 overflow-hidden rounded-md border p-3'
    >
      <div className='min-w-0'>
        <h3 className='truncate text-[13px] font-bold' title={primaryTitle}>
          {primaryTitle}
        </h3>
        {feature.length > 0 && (
          <p className='text-wrap text-[12px] text-gray-500 [overflow-wrap:anywhere]'>{feature.join(' · ')}</p>
        )}
        {compatibility.length > 0 && (
          <p className='text-wrap text-[11px] text-gray-500 [overflow-wrap:anywhere]'>
            {compatibility.join(' · ')}
          </p>
        )}
      </div>

      {(candidate.autoTranslated || candidate.hearingImpaired || candidate.foreignPartsOnly) && (
        <div className='flex min-w-0 flex-wrap gap-1' aria-label={t('result_characteristics')}>
          {candidate.autoTranslated && <ResultBadge tone='warning'>{t('result_auto_translated')}</ResultBadge>}
          {candidate.hearingImpaired && <ResultBadge>{t('result_hearing_impaired')}</ResultBadge>}
          {candidate.foreignPartsOnly && <ResultBadge tone='warning'>{t('result_foreign_parts_only')}</ResultBadge>}
        </div>
      )}

      {(candidate.fromTrusted || rating || downloads) && (
        <div className='flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-600'>
          {candidate.fromTrusted && (
            <ResultBadge tone='trusted'>
              <span
                title={t('result_trusted_source_description')}
                aria-label={`${t('result_trusted_source')}. ${t('result_trusted_source_description')}`}
              >
                {t('result_trusted_source')}
              </span>
            </ResultBadge>
          )}
          {rating && <span>{rating}</span>}
          {downloads && <span>{downloads}</span>}
        </div>
      )}

      <details className='min-w-0 rounded bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700'>
        <summary className='cursor-pointer rounded font-medium outline-none focus-visible:ring-1 focus-visible:ring-ring'>
          {t('result_details')}
        </summary>
        <dl className='mt-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1'>
          <dt className='text-gray-500'>{t('result_file_name')}</dt>
          <dd className='line-clamp-2 min-w-0 [overflow-wrap:anywhere]' title={candidate.fileName}>
            {candidate.fileName}
          </dd>
          {candidate.uploaderRank && (
            <>
              <dt className='text-gray-500'>{t('result_uploader_rank')}</dt>
              <dd className='min-w-0 [overflow-wrap:anywhere]'>{candidate.uploaderRank}</dd>
            </>
          )}
          {uploadDate && (
            <>
              <dt className='text-gray-500'>{t('result_upload_date')}</dt>
              <dd>
                <time dateTime={candidate.uploadDate}>{uploadDate}</time>
              </dd>
            </>
          )}
        </dl>
      </details>

      <Button
        variant='outline'
        size='sm'
        type='button'
        aria-label={t('add_online_subtitle', candidate.fileName)}
        disabled={disabled}
        onClick={onAdd}
      >
        {adding ? <LoaderCircleIcon className='animate-spin' /> : <DownloadIcon />}
        {t(adding ? 'adding' : 'add_this_subtitle')}
      </Button>
    </article>
  );
}
