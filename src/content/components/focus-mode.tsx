import { memo, useMemo } from 'react';

import { findSubtitleIndex } from '@utils/helper';
import { SubtitleData } from '@utils/parse';

import { videoManager } from '@/content/features/video/video-manager';
import { findTargetSubtitle } from '@/content/features/video/video-navigation';
import { useSubtitleStore } from '@/content/store/subtitle-store';
import { useVideoStore } from '@/content/store/video-store';
import { cn } from '@/ui/lib/utils';

export function FocusMode() {
  const { primarySubtitle, secondarySubtitle } = useSubtitleStore((state) => state.subtitleSettings);
  const customSubtitleId = useSubtitleStore((state) => state.customSubtitleId);
  const subtitleCache = useSubtitleStore((state) => state.subtitleCache);
  const currentTime = useVideoStore((state) => state.currentTime);

  const primarySubtitles = subtitleCache[customSubtitleId.primarySubtitle ?? primarySubtitle.language];
  const secondarySubtitles = subtitleCache[customSubtitleId.secondarySubtitle ?? secondarySubtitle.language];

  const primarySubtitleIndex = useMemo(
    () => findSubtitleIndex(primarySubtitles ?? [], currentTime - primarySubtitle.delay),
    [primarySubtitles, currentTime, primarySubtitle.delay]
  );
  const secondarySubtitleIndex = useMemo(
    () => findSubtitleIndex(secondarySubtitles ?? [], currentTime - secondarySubtitle.delay),
    [secondarySubtitles, currentTime, secondarySubtitle.delay]
  );

  return (
    <div className='absolute top-1/2 -translate-y-1/2 z-50 h-[160px] w-full pointer-events-auto'>
      {primarySubtitle.enabled && (
        <MemoizedPrimarySubtitle subtitles={primarySubtitles} currentIndex={primarySubtitleIndex} />
      )}
      {secondarySubtitle.enabled && (
        <MemoizedSecondarySubtitle subtitles={secondarySubtitles} currentIndex={secondarySubtitleIndex} />
      )}
    </div>
  );
}

const MemoizedPrimarySubtitle = memo(PrimarySubtitle);
const MemoizedSecondarySubtitle = memo(SecondarySubtitle);

interface SubtitleProps {
  subtitles: SubtitleData[] | undefined;
  currentIndex: number;
}

function PrimarySubtitle({ subtitles, currentIndex }: SubtitleProps) {
  const currentSubtitle = subtitles ? subtitles[currentIndex] : null;
  const prevSubtitle = subtitles ? findTargetSubtitle(subtitles, currentIndex, -1) : null;
  const nextSubtitle = subtitles ? findTargetSubtitle(subtitles, currentIndex, 1) : null;

  const goToPrev = () => {
    const video = videoManager.get();
    if (!video || !prevSubtitle) return;

    video.currentTime = prevSubtitle.start;
  };
  const goToNext = () => {
    const video = videoManager.get();
    if (!video || !nextSubtitle) return;

    video.currentTime = nextSubtitle.start;
  };
  const handleRepeat = () => {
    const video = videoManager.get();
    if (!video || !currentSubtitle) return;

    video.currentTime = currentSubtitle.start;
  };

  return (
    <div className='flex size-full'>
      <ClickableSubtitleRegion className='flex-1 bg-black/30 hover:bg-black/50 p-3' onClick={goToPrev}>
        <RenderedSubtitleText className='text-gray-200 text-lg' text={prevSubtitle?.text ?? ''} />
      </ClickableSubtitleRegion>

      <ClickableSubtitleRegion className='w-2/5 bg-black/50 hover:bg-black/70 p-4' onClick={handleRepeat}>
        <RenderedSubtitleText
          className='text-white text-[26px] leading-10 font-semibold'
          text={currentSubtitle?.text ?? ''}
        />
      </ClickableSubtitleRegion>

      <ClickableSubtitleRegion className='flex-1 bg-black/30 hover:bg-black/50 p-3' onClick={goToNext}>
        <RenderedSubtitleText className='text-gray-200 text-lg' text={nextSubtitle?.text ?? ''} />
      </ClickableSubtitleRegion>
    </div>
  );
}

function SecondarySubtitle({ subtitles, currentIndex }: SubtitleProps) {
  const currentSubtitle = subtitles ? subtitles[currentIndex] : null;

  return (
    <div className='absolute top-full left-1/2 -translate-x-1/2'>
      <RenderedSubtitleText className='text-gray-200 text-lg' text={currentSubtitle?.text ?? ''} />
    </div>
  );
}

function ClickableSubtitleRegion({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-center justify-center transition', className)} {...props}>
      {children}
    </div>
  );
}

function RenderedSubtitleText({ className, text, ...props }: React.ComponentProps<'p'> & { text: string }) {
  return (
    <p
      className={cn('text-center whitespace-pre-line select-none text-shadow-lg', className)}
      {...props}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}
