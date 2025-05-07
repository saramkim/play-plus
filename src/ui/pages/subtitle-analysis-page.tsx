import { useRef } from 'react';

import { useVirtualizer } from '@tanstack/react-virtual';
import { formatTime } from '@utils/helper';
import { t } from '@utils/i18n';
import { GalleryVertical } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Toggle } from '@/ui/components/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/tooltip';
import { RegisteredSubtitleSelect } from '@/ui/features/analysis/registered-subtitle-select';
import { SubtitleItem } from '@/ui/features/analysis/subtitle-item';
import { useAutoScroll } from '@/ui/features/analysis/use-auto-scroll';
import { useSubtitleAnalysis } from '@/ui/features/analysis/use-subtitle-analysis';
import { cn } from '@/ui/lib/utils';

const ESTIMATED_ITEM_HEIGHT = 37;
const GAP_HEIGHT = 4;

export function SubtitleAnalysisPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    subtitles,
    subtitleId,
    setSubtitleId,
    activeIndex,
    defaultSubtitleOptions,
    handleSaveSubtitle,
    handlePlayVideo,
  } = useSubtitleAnalysis();
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
    <div className='h-full flex flex-col'>
      <header className='flex items-center justify-between border-b p-2'>
        <div className='flex items-center gap-1 overflow-x-auto'>
          <RegisteredSubtitleSelect
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
        <div className='border-l pl-2'>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Toggle
                  pressed={isAutoScrolling}
                  onPressedChange={setIsAutoScrolling}
                  aria-label={t('auto_scroll')}
                  size='sm'
                >
                  <GalleryVertical className='size-5' />
                </Toggle>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t('auto_scroll')}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {subtitles.length === 0 ? (
        <div className='p-4 h-full flex items-center justify-center text-center'>
          <p className='whitespace-pre-line text-wrap'>{t('subtitle_analysis_description')}</p>
        </div>
      ) : (
        <div ref={containerRef} className='p-2 overflow-y-auto' onScroll={handleScroll}>
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
                      onClick={() => handlePlayVideo(subtitle.start)}
                      onSave={handleSaveSubtitle}
                      style={{ marginBottom: `${GAP_HEIGHT}px` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
