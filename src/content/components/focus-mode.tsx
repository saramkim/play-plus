import { useMemo } from 'react';

import { findSubtitleIndex } from '@utils/helper';

import { videoManager } from '@/content/features/video/video-manager';
import { findTargetSubtitle } from '@/content/features/video/video-navigation';
import { useSubtitleStore } from '@/content/store/subtitle-store';
import { useVideoStore } from '@/content/store/video-store';
import { cn } from '@/ui/lib/utils';

export function FocusMode() {
  const subtitles = useSubtitleStore((state) => {
    const id = state.customSubtitleId.primarySubtitle;
    const { language } = state.subtitleSettings.primarySubtitle;
    return state.subtitleCache[id ?? language];
  });
  const delay = useSubtitleStore((state) => state.subtitleSettings.primarySubtitle.delay);
  const currentTime = useVideoStore((state) => state.currentTime);

  const currentIndex = useMemo(
    () => (subtitles ? findSubtitleIndex(subtitles, currentTime - delay) : -1),
    [subtitles, currentTime, delay]
  );
  const currentSubtitle = useMemo(() => (subtitles ? subtitles[currentIndex] : null), [subtitles, currentIndex]);
  const prevSubtitle = useMemo(
    () => (subtitles ? findTargetSubtitle(subtitles, currentIndex, -1) : null),
    [subtitles, currentIndex]
  );
  const nextSubtitle = useMemo(
    () => (subtitles ? findTargetSubtitle(subtitles, currentIndex, 1) : null),
    [subtitles, currentIndex]
  );

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
    <div className='absolute top-1/2 -translate-y-1/2 z-50 flex w-full h-[160px] pointer-events-auto'>
      <SubtitleContainer className='flex-1 bg-black/30 hover:bg-black/50 p-3' onClick={goToPrev}>
        <Subtitle className='text-gray-200 text-lg' text={prevSubtitle?.text ?? ''} />
      </SubtitleContainer>

      <SubtitleContainer className='w-2/5 bg-black/50 hover:bg-black/70 p-4' onClick={handleRepeat}>
        <Subtitle className='text-white text-[26px] leading-10 font-semibold' text={currentSubtitle?.text ?? ''} />
      </SubtitleContainer>

      <SubtitleContainer className='flex-1 bg-black/30 hover:bg-black/50 p-3' onClick={goToNext}>
        <Subtitle className='text-gray-200 text-lg' text={nextSubtitle?.text ?? ''} />
      </SubtitleContainer>
    </div>
  );
}

function SubtitleContainer({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex items-center justify-center transition', className)} {...props}>
      {children}
    </div>
  );
}

function Subtitle({ className, text, ...props }: React.ComponentProps<'p'> & { text: string }) {
  return (
    <p
      className={cn('text-center whitespace-pre-line select-none', className)}
      {...props}
      dangerouslySetInnerHTML={{ __html: text }}
    />
  );
}
