
import { useState, useMemo } from 'react';

import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import {
  Minimize2Icon,
  SlidersVerticalIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ChevronsUpIcon,
  ChevronsDownIcon,
  RepeatIcon,
  ScanEyeIcon,
  ZapIcon,
  Repeat1Icon,
} from 'lucide-react';

import { useFocusModeStore } from '@/content/features/focus-mode/focus-mode-store';
import { loopController } from '@/content/features/loop';
import { useLoopStore } from '@/content/features/loop/loop-store';
import { skipVideoTime } from '@/content/features/navigation/video-navigation';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { gapSkipper } from '@/content/features/skipper/gap-skipper';
import { useGapSkipperStore } from '@/content/features/skipper/gap-skipper-store';

const BUTTON_SIZE = 40;

export function Controller({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLooping = useLoopStore((state) => state.isLooping);
  const loopType = useLoopStore((state) => state.loopType);
  const isFocusMode = useFocusModeStore((state) => state.isFocusMode);
  const isGapSkipping = useGapSkipperStore((state) => state.enabled);
  const increaseSpeed = usePlaybackSpeedStore((state) => state.increaseSpeed);
  const decreaseSpeed = usePlaybackSpeedStore((state) => state.decreaseSpeed);

  const buttonList = useMemo(
    () => [
      {
        title: t('previous_subtitle'),
        Icon: SkipBackIcon,
        onClick: () => skipVideoTime(-1, 'subtitles', -10, 'seconds'),
      },
      {
        title: t('next_subtitle'),
        Icon: SkipForwardIcon,
        onClick: () => skipVideoTime(1, 'subtitles', 10, 'seconds'),
      },
      {
        title: t('increase_speed'),
        Icon: ChevronsUpIcon,
        onClick: increaseSpeed,
      },
      {
        title: t('decrease_speed'),
        Icon: ChevronsDownIcon,
        onClick: decreaseSpeed,
      },
      {
        title: t('loop_playback'),
        Icon: RepeatIcon,
        onClick: () => loopController.toggleLoop(),
        className: isLooping && loopType === 'manual' ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
      {
        title: t('loop_current_subtitle'),
        Icon: Repeat1Icon,
        onClick: () => loopController.toggleLoop('subtitle'),
        className: isLooping && loopType === 'subtitle' ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
      {
        title: t('focus_mode'),
        Icon: ScanEyeIcon,
        onClick: () => useFocusModeStore.getState().toggle(),
        className: isFocusMode ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
      {
        title: t('skip_subtitle_gap'),
        Icon: ZapIcon,
        onClick: () => (isGapSkipping ? gapSkipper.stop() : gapSkipper.start()),
        className: isGapSkipping ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
    ],
    [isLooping, loopType, isFocusMode, isGapSkipping, increaseSpeed, decreaseSpeed]
  );

  return (
    <div
      className={cn(
        'absolute top-1/2 right-0 shadow-lg rounded-lg select-none pointer-events-auto flex items-center bg-black/50 hover:bg-black/80 transition-all duration-300',
        isFocusMode ? '-translate-y-[calc(100%+80px)]' : '-translate-y-1/2',
        className
      )}
    >
      {isExpanded && buttonList.map((button) => <IconButton key={button.title} {...button} />)}

      <IconButton
        Icon={isExpanded ? Minimize2Icon : SlidersVerticalIcon}
        onClick={() => setIsExpanded((prev) => !prev)}
      />
    </div>
  );
}

function IconButton({ Icon, className, ...props }: { Icon: React.ElementType } & React.ComponentProps<'button'>) {
  return (
    <button
      className={cn('text-white/70 hover:text-white cursor-pointer flex items-center justify-center', className)}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
      {...props}
    >
      <Icon className='size-5' />
    </button>
  );
}
