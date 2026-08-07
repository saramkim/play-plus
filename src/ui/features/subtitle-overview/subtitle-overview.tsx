import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import type { V2SyncStorage } from '@storage/v2/type';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn, formatTime } from '@utils/helper';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';
import type {
  SubtitleOverviewSource,
  SubtitleRole,
} from '@utils/message/type';
import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/components/tooltip';

import {
  createSubtitleOverviewRows,
  filterSubtitleOverviewRows,
  findActiveSubtitleOverviewRow,
  getSubtitleOverviewRowTimeRange,
} from './subtitle-overview-model';
import type { SubtitleOverviewMode, SubtitleOverviewRow } from './subtitle-overview-model';
import { useSubtitleOverviewSavedState } from './subtitle-overview-saved-state';
import { useSubtitleOverview } from './use-subtitle-overview';
import type {
  ReadySubtitleOverview,
  SubtitleOverviewViewState,
} from './use-subtitle-overview';

export type V2LearningProfile = V2SyncStorage['learningProfile'];

export function SubtitleOverview({
  cardRevision,
  learningCardStorage,
  learningProfile,
  onChangeSource = () => undefined,
  sourceTitles = {},
}: {
  cardRevision: number;
  learningCardStorage: V2LearningCardStorageApi;
  learningProfile: V2LearningProfile;
  onChangeSource?: (role: SubtitleRole) => void;
  sourceTitles?: Readonly<Record<string, string>>;
}) {
  const [mode, setMode] = useState<SubtitleOverviewMode>('together');
  const supportAvailable = learningProfile.supportLanguage !== null;
  const effectiveMode = mode === 'support' && !supportAvailable ? 'together' : mode;
  const { activeTabId, refresh, viewState } = useSubtitleOverview();

  useEffect(() => {
    if (!supportAvailable && mode === 'support') {
      setMode('together');
    }
  }, [mode, supportAvailable]);

  return (
    <section
      className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden'
      aria-labelledby='v2-subtitle-overview-title'
    >
      <header className='flex shrink-0 flex-col gap-2 border-b px-3 py-2'>
        <h2 id='v2-subtitle-overview-title' className='sr-only'>
          {t('v2_subtitle_overview_title')}
        </h2>
        <div className='flex min-w-0 items-center gap-2'>
          {supportAvailable ? (
            <div
              className='grid min-w-0 flex-1 grid-cols-3 divide-x overflow-hidden rounded-md border bg-background'
              role='group'
              aria-label={t('v2_subtitle_overview_role_label')}
            >
              <ModeButton
                active={effectiveMode === 'together'}
                label={t('v2_subtitle_overview_together')}
                onClick={() => setMode('together')}
              />
              <ModeButton
                active={effectiveMode === 'learning'}
                label={t('v2_subtitle_overview_learning')}
                onClick={() => setMode('learning')}
              />
              <ModeButton
                active={effectiveMode === 'support'}
                label={t('v2_subtitle_overview_support')}
                onClick={() => setMode('support')}
              />
            </div>
          ) : (
            <p className='min-w-0 flex-1 truncate text-sm font-medium'>
              {t('learning_subtitle')}
            </p>
          )}
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='size-11 shrink-0'
            aria-label={t('v2_subtitle_overview_refresh')}
            tooltip={t('v2_subtitle_overview_refresh')}
            disabled={viewState.status === 'loading'}
            onClick={() => refresh()}
          >
            <RefreshCwIcon />
          </Button>
        </div>
        {viewState.status === 'ready' && (
          <SourceSummary
            preferredRole={effectiveMode === 'support' ? 'support' : 'learning'}
            tracks={viewState.snapshot.tracks}
            sourceTitles={sourceTitles}
            onChangeSource={onChangeSource}
          />
        )}
      </header>

      <SubtitleOverviewBody
        activeTabId={activeTabId}
        cardRevision={cardRevision}
        learningCardStorage={learningCardStorage}
        mode={effectiveMode}
        state={viewState}
        onRetry={refresh}
      />
    </section>
  );
}

interface ModeButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
}

function ModeButton({ active, label, onClick }: ModeButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size='sm'
      className={cn(
        'h-9 min-w-0 rounded-none px-1 text-xs shadow-none',
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
      )}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

interface SourceSummaryProps {
  onChangeSource: (role: SubtitleRole) => void;
  preferredRole: SubtitleRole;
  sourceTitles: Readonly<Record<string, string>>;
  tracks: ReadySubtitleOverview['tracks'];
}

function SourceSummary({
  onChangeSource,
  preferredRole,
  sourceTitles,
  tracks,
}: SourceSummaryProps) {
  const activeTracks = [tracks.learning, ...(tracks.support ? [tracks.support] : [])];

  return (
    <div className='flex min-w-0 items-center gap-2 text-[11px] leading-4'>
      <dl className='min-w-0 flex-1'>
        {activeTracks.map((track) => {
          const sourceTitle = getSourceTitle(track.source, sourceTitles);
          return (
            <div key={track.role} className='flex min-w-0 gap-1'>
              <dt className='shrink-0 font-medium text-foreground/70'>
                {t(track.role === 'learning' ? 'learning_subtitle' : 'support_subtitle')} ·
              </dt>
              <dd className='min-w-0 truncate text-muted-foreground' title={sourceTitle}>
                {sourceTitle}
              </dd>
            </div>
          );
        })}
      </dl>
      <Button
        type='button'
        variant='link'
        className='h-11 shrink-0 px-1 text-xs'
        aria-label={t('v2_subtitle_overview_change_source_label')}
        onClick={() => onChangeSource(preferredRole)}
      >
        {t('v2_subtitle_overview_change_source')}
      </Button>
    </div>
  );
}

const getSourceTitle = (
  source: SubtitleOverviewSource,
  sourceTitles: Readonly<Record<string, string>>
) =>
  source.kind === 'native'
    ? t('v2_subtitle_overview_source_coupang_play')
    : sourceTitles[source.subtitleId] ?? t('v2_local_subtitles_selected_missing');

interface SubtitleOverviewBodyProps {
  activeTabId: number | undefined;
  cardRevision: number;
  learningCardStorage: V2LearningCardStorageApi;
  mode: SubtitleOverviewMode;
  state: SubtitleOverviewViewState;
  onRetry: (pendingStatus?: 'loading' | 'no-video' | 'stale') => void;
}

function SubtitleOverviewBody({
  activeTabId,
  cardRevision,
  learningCardStorage,
  mode,
  state,
  onRetry,
}: SubtitleOverviewBodyProps) {
  if (state.status === 'ready') {
    return (
      <ReadyOverview
        key={state.revision}
        activeTabId={activeTabId}
        cardRevision={cardRevision}
        learningCardStorage={learningCardStorage}
        mode={mode}
        snapshot={state.snapshot}
        onInvalidSeek={onRetry}
      />
    );
  }
  if (state.status === 'loading') {
    return <StatusPanel message={t('v2_subtitle_overview_loading')} />;
  }
  if (state.status === 'disconnected') {
    return <StatusPanel message={t('v2_subtitle_overview_disconnected')} />;
  }
  if (state.status === 'no-video') {
    return <StatusPanel message={t('v2_subtitle_overview_no_video')} onRetry={onRetry} />;
  }
  if (state.status === 'stale') {
    return <StatusPanel message={t('v2_subtitle_overview_stale')} onRetry={onRetry} />;
  }
  return <StatusPanel alert message={t('v2_subtitle_overview_error')} onRetry={onRetry} />;
}

interface ReadyOverviewProps {
  activeTabId: number | undefined;
  cardRevision: number;
  learningCardStorage: V2LearningCardStorageApi;
  onInvalidSeek: (status: 'no-video' | 'stale') => void;
  mode: SubtitleOverviewMode;
  snapshot: ReadySubtitleOverview;
}

function ReadyOverview({
  activeTabId,
  cardRevision,
  learningCardStorage,
  onInvalidSeek,
  mode,
  snapshot,
}: ReadyOverviewProps) {
  const [followEnabled, setFollowEnabled] = useState(true);
  const [detailRowKey, setDetailRowKey] = useState<string>();
  const [rovingRowKey, setRovingRowKey] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [savePending, setSavePending] = useState(false);
  const [seekError, setSeekError] = useState(false);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocusRowKeyRef = useRef<string | undefined>(undefined);
  const pointerIntentRef = useRef<
    { id: number; moved: boolean; x: number; y: number } | undefined
  >(undefined);
  const programmaticScrollFrameIdsRef = useRef<number[]>([]);
  const programmaticScrollGenerationRef = useRef(0);
  const programmaticScrollSuppressedRef = useRef(false);
  const touchDetailOpenTimerRef = useRef<number | undefined>(undefined);
  const normalizedSearchText = searchText.trim();
  const { isSaved, markSaved } = useSubtitleOverviewSavedState({
    storage: learningCardStorage,
    cardRevision,
    videoId: snapshot.identity.videoId,
    learningLanguage: snapshot.tracks.learning.language,
  });
  const rows = useMemo(
    () => createSubtitleOverviewRows(snapshot.tracks, mode),
    [mode, snapshot.tracks]
  );
  const visibleRows = useMemo(
    () => filterSubtitleOverviewRows(rows, searchText),
    [rows, searchText]
  );
  const activeRow = useMemo(
    () => findActiveSubtitleOverviewRow(rows, snapshot.currentTime),
    [rows, snapshot.currentTime]
  );
  const activeVisibleIndex = activeRow
    ? visibleRows.findIndex(({ key }) => key === activeRow.key)
    : -1;
  const timeRange = useMemo(() => getSubtitleOverviewRowTimeRange(rows), [rows]);
  const getItemKey = useCallback(
    (index: number) => visibleRows[index]?.key ?? index,
    [visibleRows]
  );
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    estimateSize: () => 49,
    getItemKey,
    getScrollElement: () => scrollElementRef.current,
    overscan: 8,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const preferredTabStopRowKey = getPreferredTabStopRowKey(
    visibleRows,
    activeRow?.key,
    rovingRowKey
  );
  const tabStopRowKey = getRenderedTabStopRowKey(
    visibleRows,
    virtualItems,
    preferredTabStopRowKey,
    rowVirtualizer.range ?? undefined
  );

  const clearTouchDetailOpenTimer = useCallback(() => {
    if (touchDetailOpenTimerRef.current === undefined) return;
    window.clearTimeout(touchDetailOpenTimerRef.current);
    touchDetailOpenTimerRef.current = undefined;
  }, []);

  const closeDetail = useCallback(() => {
    clearTouchDetailOpenTimer();
    setDetailRowKey(undefined);
  }, [clearTouchDetailOpenTimer]);

  const scheduleTouchDetailOpen = useCallback(
    (rowKey: string) => {
      clearTouchDetailOpenTimer();
      touchDetailOpenTimerRef.current = window.setTimeout(() => {
        touchDetailOpenTimerRef.current = undefined;
        setDetailRowKey(rowKey);
      }, 0);
    },
    [clearTouchDetailOpenTimer]
  );

  useEffect(() => {
    closeDetail();
    setSearchText('');
    setRovingRowKey(undefined);
  }, [closeDetail, mode]);

  const clearProgrammaticScrollFrames = useCallback(() => {
    for (const frameId of programmaticScrollFrameIdsRef.current) {
      window.cancelAnimationFrame(frameId);
    }
    programmaticScrollFrameIdsRef.current = [];
  }, []);

  const runProgrammaticScroll = useCallback(
    (scroll: () => void) => {
      const generation = ++programmaticScrollGenerationRef.current;
      clearProgrammaticScrollFrames();
      programmaticScrollSuppressedRef.current = true;
      scroll();

      const firstFrameId = window.requestAnimationFrame(() => {
        if (programmaticScrollGenerationRef.current !== generation) return;
        const secondFrameId = window.requestAnimationFrame(() => {
          if (programmaticScrollGenerationRef.current !== generation) return;
          programmaticScrollSuppressedRef.current = false;
          programmaticScrollFrameIdsRef.current = [];
        });
        if (
          programmaticScrollGenerationRef.current === generation &&
          programmaticScrollSuppressedRef.current
        ) {
          programmaticScrollFrameIdsRef.current = [secondFrameId];
        } else {
          window.cancelAnimationFrame(secondFrameId);
        }
      });
      if (
        programmaticScrollGenerationRef.current === generation &&
        programmaticScrollSuppressedRef.current
      ) {
        programmaticScrollFrameIdsRef.current = [firstFrameId];
      } else {
        window.cancelAnimationFrame(firstFrameId);
      }
    },
    [clearProgrammaticScrollFrames]
  );

  useLayoutEffect(() => {
    runProgrammaticScroll(() => {
      rowVirtualizer.scrollToOffset(0);
    });
  }, [rowVirtualizer, runProgrammaticScroll, visibleRows]);

  useEffect(() => {
    if (followEnabled && activeVisibleIndex >= 0) {
      runProgrammaticScroll(() => {
        rowVirtualizer.scrollToIndex(activeVisibleIndex, { align: 'center' });
      });
    }
  }, [activeVisibleIndex, followEnabled, rowVirtualizer, runProgrammaticScroll]);

  useEffect(
    () => () => {
      programmaticScrollGenerationRef.current += 1;
      clearProgrammaticScrollFrames();
      programmaticScrollSuppressedRef.current = false;
      clearTouchDetailOpenTimer();
    },
    [clearProgrammaticScrollFrames, clearTouchDetailOpenTimer]
  );

  useEffect(() => {
    const rowKey = pendingFocusRowKeyRef.current;
    if (rowKey === undefined) return;
    const row = rowRefs.current.get(rowKey);
    if (!row) return;
    pendingFocusRowKeyRef.current = undefined;
    row.focus();
  }, [virtualItems]);

  const disableFollow = () => setFollowEnabled(false);

  const resumeFollow = () => {
    setFollowEnabled(true);
    if (activeVisibleIndex >= 0) {
      runProgrammaticScroll(() => {
        rowVirtualizer.scrollToIndex(activeVisibleIndex, { align: 'center' });
      });
    }
  };

  const focusVisibleCue = (visibleIndex: number) => {
    const row = visibleRows[visibleIndex];
    if (!row) return;
    disableFollow();
    pendingFocusRowKeyRef.current = row.key;
    setRovingRowKey(row.key);
    runProgrammaticScroll(() => {
      rowVirtualizer.scrollToIndex(visibleIndex, { align: 'auto' });
    });
    window.requestAnimationFrame(() => {
      const rowElement = rowRefs.current.get(row.key);
      if (rowElement) {
        pendingFocusRowKeyRef.current = undefined;
        rowElement.focus();
      }
    });
  };

  const seek = (cue: SubtitleOverviewRow['cue']) => {
    if (activeTabId === undefined) return;
    setSeekError(false);
    void sendMessageToTab(activeTabId, 'playVideo', {
      startTime: cue.startTime,
      expectedIdentity: snapshot.identity,
      expectedSubtitleRevision: snapshot.subtitleRevision,
    })
      .then((response) => {
        if (!response.success) {
          setSeekError(true);
          return;
        }
        if (response.data.status === 'played') return;
        setSeekError(true);
        onInvalidSeek(response.data.status);
      })
      .catch(() => {
        setSeekError(true);
      });
  };

  const saveRow = (row: SubtitleOverviewRow) => {
    if (activeTabId === undefined || row.learningSourceIndex === undefined || savePending) return;
    setSavePending(true);
    void sendMessageToTab(activeTabId, 'saveSubtitleOverviewCue', {
      expectedIdentity: snapshot.identity,
      expectedSubtitleRevision: snapshot.subtitleRevision,
      learningSourceIndex: row.learningSourceIndex,
    })
      .then((response) => {
        if (!response.success) {
          toast.error(t('v2_subtitle_overview_save_error'));
          return;
        }

        const status = response.data.status;
        if (status === 'saved-with-support') {
          markSaved(row);
          toast.success(t('v2_subtitle_overview_saved_with_support'));
        } else if (status === 'saved-learning-only') {
          markSaved(row);
          toast.success(t('v2_subtitle_overview_saved_learning_only'));
        } else if (status === 'busy') {
          toast.info(t('v2_subtitle_overview_save_busy'));
        } else if (status === 'stale') {
          toast.error(t('v2_subtitle_overview_save_stale'));
        } else if (status === 'no-video') {
          toast.error(t('v2_subtitle_overview_no_video'));
        } else if (status === 'cue-unavailable') {
          toast.error(t('v2_subtitle_overview_save_unavailable'));
        } else {
          toast.error(t('v2_subtitle_overview_save_error'));
        }
      })
      .catch(() => {
        toast.error(t('v2_subtitle_overview_save_error'));
      })
      .finally(() => {
        setSavePending(false);
      });
  };

  if (rows.length === 0) {
    return (
      <StatusPanel
        message={
          mode === 'support'
            ? t('v2_subtitle_overview_empty_support')
            : t('v2_subtitle_overview_empty_learning')
        }
      />
    );
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <div className='flex shrink-0 flex-col gap-1.5 border-b px-3 py-2'>
        <div className='relative min-w-0'>
          <Input
            type='search'
            className='h-11 pr-11'
            aria-label={t('v2_subtitle_overview_search_label')}
            value={searchText}
            onChange={(event) => {
              const value = event.target.value;
              setSearchText(value);
              if (value.trim() !== '') disableFollow();
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
            onClick={() => setSearchText('')}
          >
            <XIcon />
          </Button>
        </div>
        <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
          <span>
            {t(
              'v2_subtitle_overview_count',
              visibleRows.length.toString(),
              rows.length.toString()
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
          {normalizedSearchText === '' &&
            (followEnabled ? (
              <span className='font-medium text-primary' role='status'>
                {t('v2_subtitle_overview_following')}
              </span>
            ) : (
              <Button
                type='button'
                variant='link'
                className='h-auto p-0 text-xs'
                onClick={resumeFollow}
              >
                {t('v2_subtitle_overview_resume_follow')}
              </Button>
            ))}
        </div>
        {seekError && (
          <p className='text-wrap text-xs text-destructive' role='alert'>
            {t('v2_subtitle_overview_seek_error')}
          </p>
        )}
      </div>

      {visibleRows.length === 0 ? (
        <StatusPanel message={t('v2_subtitle_overview_no_results')} />
      ) : (
        <div
          ref={scrollElementRef}
          className='min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-2'
          data-scroll-owner='subtitle-overview'
          onScroll={() => {
            if (!programmaticScrollSuppressedRef.current) {
              const intent = pointerIntentRef.current;
              if (intent) pointerIntentRef.current = { ...intent, moved: true };
              disableFollow();
              closeDetail();
            }
          }}
          onWheel={() => {
            disableFollow();
            closeDetail();
          }}
          onTouchMove={() => {
            const intent = pointerIntentRef.current;
            if (intent) pointerIntentRef.current = { ...intent, moved: true };
            disableFollow();
            closeDetail();
          }}
          onKeyDownCapture={(event) => {
            if (['ArrowDown', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'].includes(event.key)) {
              disableFollow();
            }
          }}
          onPointerDown={(event) => {
            pointerIntentRef.current = {
              id: event.pointerId,
              moved: false,
              x: event.clientX,
              y: event.clientY,
            };
          }}
          onPointerMove={(event) => {
            const start = pointerIntentRef.current;
            if (
              start?.id === event.pointerId &&
              (Math.abs(event.clientX - start.x) > 4 || Math.abs(event.clientY - start.y) > 4)
            ) {
              pointerIntentRef.current = { ...start, moved: true };
              disableFollow();
            }
          }}
          onPointerUp={() => {
            pointerIntentRef.current = undefined;
          }}
          onPointerCancel={() => {
            pointerIntentRef.current = undefined;
          }}
        >
          <div
            className='relative w-full'
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((virtualRow) => {
              const row = visibleRows[virtualRow.index];
              const active = row.key === activeRow?.key;
              const canSave = row.learningSourceIndex !== undefined;
              const saved = isSaved(row);
              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  data-row-key={row.key}
                  className='absolute top-0 left-0 w-full border-b border-border/70'
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <div
                    className={cn(
                      'relative flex min-w-0 bg-background',
                      active && 'bg-primary/10'
                    )}
                  >
                    {active && (
                      <span
                        className='pointer-events-none absolute inset-y-1 left-0 z-10 w-0.5 rounded-full bg-primary'
                        data-subtitle-overview-current-marker='true'
                        aria-hidden='true'
                      />
                    )}
                    <Tooltip
                      open={detailRowKey === row.key}
                      onOpenChange={(open) => {
                        setDetailRowKey((current) =>
                          open ? row.key : current === row.key ? undefined : current
                        );
                      }}
                    >
                      <TooltipTrigger asChild>
                        <button
                          ref={(element) => {
                            if (element) rowRefs.current.set(row.key, element);
                            else rowRefs.current.delete(row.key);
                          }}
                          type='button'
                          data-subtitle-overview-seek='true'
                          tabIndex={row.key === tabStopRowKey ? 0 : -1}
                          aria-current={active ? 'true' : undefined}
                          aria-label={getCueDetailLabel(row, active)}
                          className='grid min-h-12 min-w-0 flex-1 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-2 px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent-light focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-ring/50'
                          onFocus={() => {
                            disableFollow();
                            setRovingRowKey(row.key);
                          }}
                          onPointerUp={(event) => {
                            const intent = pointerIntentRef.current;
                            if (
                              event.pointerType === 'touch' &&
                              intent?.id === event.pointerId &&
                              !intent.moved
                            ) {
                              scheduleTouchDetailOpen(row.key);
                            }
                          }}
                          onClick={() => seek(row.cue)}
                          onKeyDown={(event) => {
                            const nextIndex = getKeyboardTargetIndex(
                              event.key,
                              virtualRow.index,
                              visibleRows.length
                            );
                            if (nextIndex === undefined) return;
                            event.preventDefault();
                            focusVisibleCue(nextIndex);
                          }}
                        >
                          <span className='min-w-0 truncate text-[11px] leading-none tabular-nums text-muted-foreground'>
                            {formatTimestamp(row.cue.startTime)}
                          </span>
                          <span className='flex min-w-0 flex-col justify-center'>
                            {active && (
                              <span className='sr-only'>
                                {t('v2_subtitle_overview_current')}
                              </span>
                            )}
                            <span
                              className='truncate text-sm leading-5'
                              data-subtitle-overview-learning-text='true'
                            >
                              {row.cue.text}
                            </span>
                            {row.alignedSupport && (
                              <span
                                className='truncate text-xs leading-4 text-muted-foreground'
                                data-subtitle-overview-support-text='true'
                              >
                                {row.alignedSupport.text}
                              </span>
                            )}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side='top'
                        align='start'
                        className='max-h-[min(calc(100dvh_-_1rem),var(--radix-tooltip-content-available-height))] max-w-[min(20rem,calc(100vw_-_1rem))] overflow-y-auto whitespace-normal break-words text-left text-pretty'
                      >
                        <span className='block'>{row.cue.text}</span>
                        {row.alignedSupport && (
                          <span className='mt-1 block text-primary-foreground/80'>
                            {row.alignedSupport.text}
                          </span>
                        )}
                        <span className='mt-1 block text-[11px] text-primary-foreground/70'>
                          {formatTimestamp(row.cue.startTime)}–
                          {formatTimestamp(row.cue.endTime)}
                        </span>
                      </TooltipContent>
                    </Tooltip>
                    {canSave && (
                      <div className='flex shrink-0 items-center border-l border-border/60 px-0.5'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          className='size-11'
                          data-subtitle-overview-save='true'
                          aria-label={`${t(
                            saved
                              ? 'v2_subtitle_overview_saved_row'
                              : 'v2_subtitle_overview_save_row'
                          )}: ${row.cue.text}`}
                          tooltip={t(
                            saved
                              ? 'v2_subtitle_overview_saved_row'
                              : 'v2_subtitle_overview_save_row'
                          )}
                          disabled={savePending}
                          tabIndex={row.key === tabStopRowKey ? 0 : -1}
                          onFocus={() => {
                            disableFollow();
                            setRovingRowKey(row.key);
                          }}
                          onClick={() => saveRow(row)}
                          onKeyDown={(event) => {
                            const nextIndex = getKeyboardTargetIndex(
                              event.key,
                              virtualRow.index,
                              visibleRows.length
                            );
                            if (nextIndex === undefined) return;
                            event.preventDefault();
                            focusVisibleCue(nextIndex);
                          }}
                        >
                          {saved ? <BookmarkCheckIcon /> : <BookmarkPlusIcon />}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatusPanelProps {
  alert?: boolean;
  message: string;
  onRetry?: () => void;
}

function StatusPanel({ alert = false, message, onRetry }: StatusPanelProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center'>
      <p
        className={cn('text-wrap text-sm', alert ? 'text-destructive' : 'text-muted-foreground')}
        role={alert ? 'alert' : 'status'}
      >
        {message}
      </p>
      {onRetry && (
        <Button type='button' variant='outline' size='sm' onClick={() => onRetry()}>
          {t('v2_retry')}
        </Button>
      )}
    </div>
  );
}

const getPreferredTabStopRowKey = (
  rows: SubtitleOverviewRow[],
  activeRowKey: string | undefined,
  rovingRowKey: string | undefined
) => {
  if (rows.some(({ key }) => key === rovingRowKey)) return rovingRowKey;
  if (rows.some(({ key }) => key === activeRowKey)) return activeRowKey;
  return rows[0]?.key;
};

const getRenderedTabStopRowKey = (
  rows: SubtitleOverviewRow[],
  virtualItems: { index: number }[],
  preferredRowKey: string | undefined,
  viewportRange: { endIndex: number; startIndex: number } | undefined
) => {
  const preferredIndex = rows.findIndex(({ key }) => key === preferredRowKey);
  const preferredIsRendered = virtualItems.some(({ index }) => index === preferredIndex);
  const preferredIsVisible =
    viewportRange === undefined ||
    (preferredIndex >= viewportRange.startIndex && preferredIndex <= viewportRange.endIndex);
  if (preferredIsRendered && preferredIsVisible) return preferredRowKey;
  if (
    viewportRange !== undefined &&
    virtualItems.some(({ index }) => index === viewportRange.startIndex)
  ) {
    return rows[viewportRange.startIndex]?.key;
  }
  return rows[virtualItems[0]?.index]?.key;
};

const getKeyboardTargetIndex = (key: string, currentIndex: number, count: number) => {
  if (key === 'ArrowDown') return Math.min(currentIndex + 1, count - 1);
  if (key === 'ArrowUp') return Math.max(currentIndex - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return undefined;
};

const formatTimestamp = (seconds: number) =>
  seconds < 0 ? `−${formatTime(Math.abs(seconds))}` : formatTime(seconds);

const getCueDetailLabel = (row: SubtitleOverviewRow, active: boolean) =>
  [
    ...(active ? [t('v2_subtitle_overview_current')] : []),
    row.cue.text,
    ...(row.alignedSupport ? [row.alignedSupport.text] : []),
    `${formatTimestamp(row.cue.startTime)}–${formatTimestamp(row.cue.endTime)}`,
  ].join('. ');
