import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { SubtitleId } from '@storage/subtitle';
import type { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LANGUAGES } from '@utils/constants';
import { cn, formatTime } from '@utils/helper';
import { t } from '@utils/i18n';
import { ArrowLeftIcon, XIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';

import {
  createRegisteredSubtitlePreviewCues,
  filterRegisteredSubtitlePreviewCues,
  getRegisteredSubtitlePreviewTimeRange,
} from './registered-subtitle-preview-model';
import type { RegisteredSubtitlePreviewCue } from './registered-subtitle-preview-model';
import { useRegisteredSubtitlePreview } from './use-registered-subtitle-preview';
import type { RegisteredSubtitlePreviewState } from './use-registered-subtitle-preview';

export interface RegisteredSubtitlePreviewProps {
  onBack: () => void;
  subtitle: V2RegisteredSubtitleMetadata | undefined;
  subtitleId: SubtitleId;
}

export function RegisteredSubtitlePreview({
  onBack,
  subtitle,
  subtitleId,
}: RegisteredSubtitlePreviewProps) {
  const available = subtitle?.id === subtitleId;
  const { retry, viewState } = useRegisteredSubtitlePreview(subtitleId, available);

  return (
    <section
      className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden'
      aria-labelledby='v2-registered-subtitle-preview-title'
    >
      <header className='flex shrink-0 items-center gap-2 border-b px-2 py-2'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-11 shrink-0'
          aria-label={t('v2_registered_subtitle_preview_back')}
          tooltip={t('v2_registered_subtitle_preview_back')}
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <div className='min-w-0 flex-1'>
          <h2
            id='v2-registered-subtitle-preview-title'
            className='text-[11px] font-medium text-muted-foreground'
          >
            {t('v2_registered_subtitle_preview_title')}
          </h2>
          <p className='truncate text-sm font-semibold' title={subtitle?.title}>
            {subtitle?.title ?? t('v2_registered_subtitle_preview_unavailable')}
          </p>
        </div>
        {subtitle && (
          <span className='shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground'>
            {t(LANGUAGES[subtitle.language])}
          </span>
        )}
      </header>

      <RegisteredSubtitlePreviewBody
        retry={retry}
        state={viewState}
        subtitle={available ? subtitle : undefined}
      />
    </section>
  );
}

interface RegisteredSubtitlePreviewBodyProps {
  retry: () => void;
  state: RegisteredSubtitlePreviewState;
  subtitle: V2RegisteredSubtitleMetadata | undefined;
}

function RegisteredSubtitlePreviewBody({
  retry,
  state,
  subtitle,
}: RegisteredSubtitlePreviewBodyProps) {
  if (state.status === 'unavailable' || subtitle === undefined) {
    return <StatusPanel message={t('v2_registered_subtitle_preview_unavailable')} />;
  }
  if (state.status === 'loading') {
    return <StatusPanel message={t('v2_registered_subtitle_preview_loading')} />;
  }
  if (state.status === 'error') {
    return (
      <StatusPanel
        alert
        message={t('v2_registered_subtitle_preview_error')}
        onRetry={retry}
      />
    );
  }

  return <ReadyRegisteredSubtitlePreview cues={state.cues} subtitle={subtitle} />;
}

function ReadyRegisteredSubtitlePreview({
  cues,
  subtitle,
}: {
  cues: Extract<RegisteredSubtitlePreviewState, { status: 'ready' }>['cues'];
  subtitle: V2RegisteredSubtitleMetadata;
}) {
  const [expandedSourceIndex, setExpandedSourceIndex] = useState<number>();
  const [searchText, setSearchText] = useState('');
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const previewCues = useMemo(
    () => createRegisteredSubtitlePreviewCues(cues, subtitle.delay ?? 0),
    [cues, subtitle.delay]
  );
  const visibleCues = useMemo(
    () => filterRegisteredSubtitlePreviewCues(previewCues, searchText),
    [previewCues, searchText]
  );
  const timeRange = useMemo(
    () => getRegisteredSubtitlePreviewTimeRange(previewCues),
    [previewCues]
  );
  const getItemKey = useCallback(
    (index: number) => visibleCues[index]?.sourceIndex ?? index,
    [visibleCues]
  );
  const rowVirtualizer = useVirtualizer({
    count: visibleCues.length,
    estimateSize: () => 44,
    getItemKey,
    getScrollElement: () => scrollElementRef.current,
    overscan: 8,
  });

  useEffect(() => {
    setExpandedSourceIndex(undefined);
    setSearchText('');
  }, [subtitle.id]);

  useLayoutEffect(() => {
    rowVirtualizer.scrollToOffset(0);
  }, [rowVirtualizer, visibleCues]);

  if (previewCues.length === 0) {
    return <StatusPanel message={t('v2_registered_subtitle_preview_empty')} />;
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <div className='flex shrink-0 flex-col gap-1.5 border-b px-3 py-2'>
        <div className='relative min-w-0'>
          <Input
            type='search'
            className='h-11 pr-11'
            aria-label={t('v2_registered_subtitle_preview_search_label')}
            value={searchText}
            onChange={(event) => {
              setExpandedSourceIndex(undefined);
              setSearchText(event.target.value);
            }}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='absolute top-0 right-0 size-11'
            aria-label={t('clear_search')}
            tooltip={t('clear_search')}
            disabled={searchText === ''}
            onClick={() => {
              setExpandedSourceIndex(undefined);
              setSearchText('');
            }}
          >
            <XIcon />
          </Button>
        </div>
        <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground'>
          <span>
            {t(
              'v2_subtitle_overview_count',
              visibleCues.length.toString(),
              previewCues.length.toString()
            )}
          </span>
          {timeRange && (
            <span>
              {t(
                'v2_subtitle_overview_time_range',
                formatTimestamp(timeRange.startTime),
                formatTimestamp(timeRange.endTime)
              )}
            </span>
          )}
          <span>{t('v2_local_subtitles_sync_value', formatDelay(subtitle.delay))}</span>
        </div>
      </div>

      {visibleCues.length === 0 ? (
        <StatusPanel message={t('v2_subtitle_overview_no_results')} />
      ) : (
        <div
          ref={scrollElementRef}
          className='min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-1.5'
          data-scroll-owner='registered-subtitle-preview'
        >
          <div
            className='relative w-full'
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const cue = visibleCues[virtualRow.index];
              const expanded = expandedSourceIndex === cue.sourceIndex;
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className='absolute top-0 left-0 w-full pb-1'
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <PreviewCueRow
                    cue={cue}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedSourceIndex((current) =>
                        current === cue.sourceIndex ? undefined : cue.sourceIndex
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewCueRow({
  cue,
  expanded,
  onToggle,
}: {
  cue: RegisteredSubtitlePreviewCue;
  expanded: boolean;
  onToggle: () => void;
}) {
  const startTime = formatTimestamp(cue.startTime);
  const endTime = formatTimestamp(cue.endTime);
  const fullRange = `${startTime}–${endTime}`;

  return (
    <button
      type='button'
      className='group flex min-h-11 w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-accent-light focus-visible:bg-accent-light focus-visible:ring-1 focus-visible:ring-ring/50'
      aria-expanded={expanded}
      aria-label={`${cue.text}, ${fullRange}`}
      data-preview-cue={cue.sourceIndex}
      data-preview-expanded={expanded || undefined}
      title={`${cue.text}\n${fullRange}`}
      onClick={onToggle}
    >
      <span className='shrink-0 pt-0.5 text-[11px] leading-5 text-muted-foreground'>
        <span>{startTime}</span>
        <span
          className={cn(
            'hidden group-hover:inline group-focus:inline',
            expanded && 'inline'
          )}
          data-preview-end-time
        >
          –{endTime}
        </span>
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 whitespace-pre-wrap text-sm leading-5 [overflow-wrap:anywhere] group-hover:line-clamp-none group-focus:line-clamp-none',
          expanded ? 'line-clamp-none' : 'line-clamp-1'
        )}
      >
        {cue.text}
      </span>
    </button>
  );
}

function StatusPanel({
  alert = false,
  message,
  onRetry,
}: {
  alert?: boolean;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center'>
      <p
        className={cn('text-wrap text-sm', alert ? 'text-destructive' : 'text-muted-foreground')}
        role={alert ? 'alert' : 'status'}
      >
        {message}
      </p>
      {onRetry && (
        <Button type='button' variant='outline' size='sm' onClick={onRetry}>
          {t('v2_retry')}
        </Button>
      )}
    </div>
  );
}

const formatDelay = (delay?: number) => (delay ?? 0).toFixed(1).replace(/\.0$/, '');

const formatTimestamp = (seconds: number) =>
  seconds < 0 ? `−${formatTime(Math.abs(seconds))}` : formatTime(seconds);
