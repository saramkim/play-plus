
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatTime, cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { SubtitleData } from '@utils/parse';
import { GalleryVertical } from 'lucide-react';
import { useRef } from 'react';

import { Button } from '@/ui/components/button';
import { SubtitleItem } from '@/ui/features/analysis/subtitle-item';
import { useAutoScroll } from '@/ui/features/analysis/use-auto-scroll';
import { useSubtitleAnalysis } from '@/ui/features/analysis/use-subtitle-analysis';
import { UploadedSubtitleSelect } from '@/ui/features/subtitle-upload/uploaded-subtitle-select';

const ESTIMATED_ITEM_HEIGHT = 37;
const GAP_HEIGHT = 4;

export function SubtitleAnalysisPage() {
  const {
    subtitles,
    subtitleId,
    setSubtitleId,
    activeIndex,
    defaultSubtitleOptions,
    handleToggleSubtitle,
    isSubtitleSaved,
    handlePlayVideo,
  } = useSubtitleAnalysis();

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
          subtitles={subtitles}
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
  activeIndex: number;
  handleToggleSubtitle: (subtitle: SubtitleData) => void;
  isSubtitleSaved: (content: string) => boolean;
  handlePlayVideo: (start: number) => void;
}

function SubtitleAnalysis({
  subtitles,
  activeIndex,
  handleToggleSubtitle,
  isSubtitleSaved,
  handlePlayVideo,
}: SubtitleAnalysisProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: subtitles.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT + GAP_HEIGHT,
    overscan: 5,
  });

  const { isAutoScrolling, setIsAutoScrolling, handleScroll } = useAutoScroll(activeIndex, (index) =>
    rowVirtualizer.scrollToIndex(index, { align: 'center' })
  );

  return (
    <div className='relative h-full overflow-hidden'>
      <div ref={containerRef} className='h-full overflow-y-auto p-2' onScroll={handleScroll}>
        <div className='flex flex-col gap-2'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground'>{t('subtitle_count', subtitles.length.toString())}</span>
            <p className='text-muted-foreground'>
              {formatTime(subtitles[0].start)} - {formatTime(subtitles[subtitles.length - 1].end)}
            </p>
          </div>
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }} className='relative w-full'>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const index = virtualRow.index;
              const subtitle = subtitles[index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={index}
                  ref={rowVirtualizer.measureElement}
                  className='absolute top-0 left-0 w-full'
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <SubtitleItem
                    subtitle={subtitle}
                    isActive={index === activeIndex}
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

      {!isAutoScrolling && (
        <Button
          variant='outline'
          size='icon'
          aria-label={t('auto_scroll')}
          className='absolute top-2 right-3 shadow-lg'
          onClick={() => setIsAutoScrolling(true)}
          tooltip={t('auto_scroll')}
        >
          <GalleryVertical className='size-5' />
        </Button>
      )}
    </div>
  );
}
