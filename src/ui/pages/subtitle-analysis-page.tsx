import { t } from '@utils/i18n';
import { MouseIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Toggle } from '@/ui/components/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/tooltip';
import { RegisteredSubtitleSelect } from '@/ui/features/analysis/registered-subtitle-select';
import { SubtitleItem } from '@/ui/features/analysis/subtitle-item';
import { useAutoScroll } from '@/ui/features/analysis/use-auto-scroll';
import { useSubtitleAnalysis } from '@/ui/features/analysis/use-subtitle-analysis';
import { cn } from '@/ui/lib/utils';

export function SubtitleAnalysisPage() {
  const {
    subtitles,
    subtitleId,
    setSubtitleId,
    activeIndex,
    defaultSubtitleOptions,
    handleSaveSubtitle,
    handlePlayVideo,
  } = useSubtitleAnalysis();
  const { autoScroll, setAutoScroll, activeSubtitleRef } = useAutoScroll(activeIndex);

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
                <Toggle pressed={autoScroll} onPressedChange={setAutoScroll} aria-label={t('auto_scroll')} size='sm'>
                  <MouseIcon className='size-5' />
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
        <div className='p-2 overflow-y-auto'>
          <ul className='flex flex-col gap-1'>
            {subtitles.map((subtitle, index) => (
              <SubtitleItem
                key={index}
                ref={index === activeIndex ? activeSubtitleRef : null}
                subtitle={subtitle}
                isActive={index === activeIndex}
                onClick={() => handlePlayVideo(subtitle.start)}
                onSave={handleSaveSubtitle}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
