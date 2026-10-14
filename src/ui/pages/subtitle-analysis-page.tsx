
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { getCoupangPlayVideoId } from '@utils/coupang-play';
import { formatTime, cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { SubtitleData } from '@utils/parse';
import { GalleryVertical, XIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { SubtitleItem } from '@/ui/features/analysis/subtitle-item';
import { findCompanionCues, useAnalysisCompanion } from '@/ui/features/analysis/use-analysis-companion';
import { useAutoScroll } from '@/ui/features/analysis/use-auto-scroll';
import { useSubtitleAnalysis } from '@/ui/features/analysis/use-subtitle-analysis';
import { UploadedSubtitleSelect } from '@/ui/features/subtitle-upload/uploaded-subtitle-select';
import { useTabStore } from '@/ui/store/tab-store';

const ESTIMATED_ITEM_HEIGHT = 57;
const GAP_HEIGHT = 4;

export function SubtitleAnalysisPage() {
  const activeTab = useTabStore((state) => state.activeTab);
  const [identity, setIdentity] = useState<{ tabId?: number; cachedUrl?: string; videoId: string | null }>({ videoId: null });
  const videoId = identity.tabId === activeTab?.id && identity.cachedUrl === activeTab?.url ? identity.videoId : null;
  useEffect(() => {
    const tabId = activeTab?.id;
    const cachedUrl = activeTab?.url;
    let cancelled = false;
    let revision = 0;
    const update = (url?: string) => setIdentity({ tabId, cachedUrl, videoId: getCoupangPlayVideoId(url) });
    update(); // Fail closed until the current tab is read; cached activeTab may predate an SPA transition.
    if (tabId === undefined) return;
    const handleUpdated = (tabId: number, change: chrome.tabs.TabChangeInfo) => {
      if (tabId === activeTab?.id && change.url !== undefined) {
        revision++;
        update(change.url);
      }
    };
    chrome.tabs.onUpdated.addListener(handleUpdated);
    const readRevision = revision;
    void chrome.tabs.get(tabId).then((tab) => {
      if (!cancelled && revision === readRevision) update(tab.url);
    }, () => {
      if (!cancelled && revision === readRevision) update();
    });
    return () => { cancelled = true; chrome.tabs.onUpdated.removeListener(handleUpdated); };
  }, [activeTab?.id, activeTab?.url]);
  const {
    subtitles,
    subtitleId,
    setSubtitleId,
    activeIndex,
    defaultSubtitleOptions,
    handleToggleSubtitle,
    isSubtitleSaved,
    handlePlayVideo,
  } = useSubtitleAnalysis(videoId);

  return (
    <div className='h-full flex flex-col'>
      <header className='flex items-center justify-between border-b p-2'>
        <div className='flex items-center gap-1 overflow-x-auto'>
          <UploadedSubtitleSelect
            selectedId={subtitleId === 'en' || subtitleId === 'ko' ? null : subtitleId}
            onSelect={setSubtitleId}
          />
          {defaultSubtitleOptions.map(({ id, label }) => (
            <Button
              variant='outline'
              size='sm'
              key={id}
              onClick={() => setSubtitleId(id)}
              className={cn(id === subtitleId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
            >
              {label}
            </Button>
          ))}
        </div>
      </header>

      {subtitles.length === 0 ? (
        <EmptyState />
      ) : (
        <SubtitleAnalysis
          key={`${activeTab?.id ?? ''}:${videoId ?? ''}:${subtitleId}`}
          subtitles={subtitles}
          subtitleId={subtitleId}
          videoId={videoId}
          activeIndex={activeIndex}
          handleToggleSubtitle={handleToggleSubtitle}
          isSubtitleSaved={isSubtitleSaved}
          handlePlayVideo={handlePlayVideo}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className='flex-1 flex items-center justify-center p-4 '>
      <p className='whitespace-pre-line text-wrap text-center text-gray-500'>{t('subtitle_analysis_description')}</p>
    </div>
  );
}

interface SubtitleAnalysisProps {
  subtitles: SubtitleData[];
  subtitleId: string;
  videoId: string | null;
  activeIndex: number;
  handleToggleSubtitle: (subtitle: SubtitleData) => void;
  isSubtitleSaved: (content: string) => boolean;
  handlePlayVideo: (start: number) => void;
}

function SubtitleAnalysis({
  subtitles,
  subtitleId,
  videoId,
  activeIndex,
  handleToggleSubtitle,
  isSubtitleSaved,
  handlePlayVideo,
}: SubtitleAnalysisProps) {
  const companion = useAnalysisCompanion(subtitleId, videoId);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const previousQueryRef = useRef('');
  const playButtonsRef = useRef(new Map<number, HTMLButtonElement>());
  const pendingFocusRef = useRef<number | null>(null);
  const [navigationIndex, setNavigationIndex] = useState<number | null>(null);
  const query = searchText.trim().toLowerCase();
  const visibleRows = useMemo(() => subtitles
    .map((subtitle, sourceIndex) => ({ subtitle, sourceIndex }))
    .filter(({ subtitle }) => !query || subtitle.text.toLowerCase().includes(query)), [subtitles, query]);

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getItemKey: (index) => visibleRows[index].sourceIndex,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT + GAP_HEIGHT,
    overscan: 5,
    // Dynamic companion heights can briefly move the focused target outside the measured range.
    rangeExtractor: (range) => {
      const indices = defaultRangeExtractor(range);
      return navigationIndex !== null && navigationIndex < visibleRows.length
        ? [...new Set([...indices, navigationIndex])].sort((a, b) => a - b) : indices;
    },
  });

  const scrollToIndex = useCallback((index: number) => {
    if (visibleRows.length > 0) rowVirtualizer.scrollToIndex(Math.min(index, visibleRows.length - 1), { align: 'center' });
  }, [rowVirtualizer, visibleRows.length]);
  const { isAutoScrolling, setIsAutoScrolling, pauseFollowing } = useAutoScroll(activeIndex, scrollToIndex, query === '');

  const navigateRow = (event: React.KeyboardEvent, index: number) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'PageUp' || event.key === 'PageDown') pauseFollowing();
    const next = event.key === 'ArrowDown' ? index + 1 : event.key === 'ArrowUp' ? index - 1
      : event.key === 'Home' ? 0 : event.key === 'End' ? visibleRows.length - 1 : null;
    if (next === null) return;
    event.preventDefault();
    pauseFollowing();
    const target = Math.max(0, Math.min(next, visibleRows.length - 1));
    pendingFocusRef.current = target;
    setNavigationIndex(target);
    rowVirtualizer.scrollToIndex(target, { align: 'auto' });
    const button = playButtonsRef.current.get(target);
    if (button) { button.focus({ preventScroll: true }); pendingFocusRef.current = null; }
  };

  useEffect(() => {
    if (previousQueryRef.current !== query) rowVirtualizer.scrollToOffset(0);
    previousQueryRef.current = query;
  }, [query, rowVirtualizer]);

  const updateSearch = (value: string) => {
    pendingFocusRef.current = null;
    setNavigationIndex(null);
    setSearchText(value);
    if (value.trim()) setIsAutoScrolling(false);
  };

  return (
    <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
      <label className='flex min-w-0 items-center gap-2 border-b p-2 text-sm'>
        <span className='shrink-0'>{t('analysis_companion')}</span>
        <select aria-label={t('analysis_companion')} value={companion.selectedId}
          onChange={(event) => companion.setSelectedId(event.target.value)}
          className='min-w-0 flex-1 rounded border bg-background p-1 text-foreground'>
          <option value=''>{t('analysis_companion_none')}</option>
          {companion.options.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <div className='flex items-center gap-2 border-b p-2'>
        <Input ref={searchInputRef} type='search' aria-label={t('subtitle_body_search')} placeholder={t('subtitle_body_search')}
          value={searchText} onChange={(event) => updateSearch(event.target.value)} />
        <Button type='button' size='icon' variant='ghost' aria-label={t('clear_search')} tooltip={t('clear_search')}
          disabled={searchText === ''} onClick={() => { updateSearch(''); searchInputRef.current?.focus(); }}>
          <XIcon className='size-4' />
        </Button>
      </div>
      <div ref={containerRef} className='min-h-0 flex-1 overflow-y-auto p-2'
        onWheel={pauseFollowing} onTouchMove={pauseFollowing}
        onPointerDown={(event) => { if (event.target === event.currentTarget) pauseFollowing(); }}>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground' role='status'>{query
              ? t('subtitle_search_count', visibleRows.length.toString(), subtitles.length.toString())
              : t('subtitle_count', subtitles.length.toString())}</span>
            <p className='text-muted-foreground'>
              {formatTime(subtitles[0].start)} - {formatTime(subtitles[subtitles.length - 1].end)}
            </p>
          </div>
          {visibleRows.length === 0 && <p className='text-wrap text-center text-muted-foreground'>{t('subtitle_search_empty')}</p>}
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }} className='relative w-full'>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const index = virtualRow.index;
              const { subtitle, sourceIndex } = visibleRows[index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={index}
                  ref={rowVirtualizer.measureElement}
                  className='absolute top-0 left-0 w-full'
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <SubtitleItem
                    onKeyDown={(event) => navigateRow(event, index)}
                    onFocusCapture={(event) => {
                      if (event.target.matches(':focus-visible')) pauseFollowing();
                    }}
                    playButtonRef={(button) => {
                      if (!button) { playButtonsRef.current.delete(index); return; }
                      playButtonsRef.current.set(index, button);
                      if (pendingFocusRef.current === index) {
                        button.focus({ preventScroll: true }); pendingFocusRef.current = null;
                      }
                    }}
                    subtitle={subtitle}
                    companionCues={findCompanionCues(subtitle, companion.cues)}
                    isActive={sourceIndex === activeIndex}
                    isSaved={isSubtitleSaved(subtitle.text)}
                    onClick={() => handlePlayVideo(subtitle.start)}
                    onToggleSave={handleToggleSubtitle}
                    style={{ marginBottom: `${GAP_HEIGHT}px` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className='flex items-center justify-between gap-2 border-t p-2'>
        <span className='whitespace-normal text-xs text-muted-foreground'>{t(query ? 'analysis_follow_search'
          : isAutoScrolling ? 'analysis_following' : 'analysis_follow_paused')}</span>
        {!isAutoScrolling && query === '' && (
        <Button
          variant='outline'
          size='sm'
          aria-label={t('auto_scroll')}
          onClick={() => setIsAutoScrolling(true)}
          tooltip={t('auto_scroll')}
        >
          <GalleryVertical className='size-5' />
          {t('analysis_follow_resume')}
        </Button>
      )}
      </div>
    </div>
  );
}
