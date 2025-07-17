import { useState, useMemo } from 'react';

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
} from 'lucide-react';

import { useFocusModeStore } from '@/content/features/focus-mode/focus-mode-store';
import { loopController } from '@/content/features/loop';
import { useLoopStore } from '@/content/features/loop/loop-store';
import { skipVideoTime } from '@/content/features/navigation/video-navigation';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { gapSkipper } from '@/content/features/skipper/gap-skipper';
import { useGapSkipperStore } from '@/content/features/skipper/gap-skipper-store';
import { cn } from '@/ui/lib/utils';

const BUTTON_SIZE = 40;

export function Controller({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLooping = useLoopStore((state) => state.isLooping);
  const isFocusMode = useFocusModeStore((state) => state.isFocusMode);
  const isGapSkipping = useGapSkipperStore((state) => state.enabled);
  const increaseSpeed = usePlaybackSpeedStore((state) => state.increaseSpeed);
  const decreaseSpeed = usePlaybackSpeedStore((state) => state.decreaseSpeed);

  const buttonList = useMemo(
    () => [
      {
        Icon: SkipBackIcon,
        onClick: () => skipVideoTime(-1, 'subtitles', -10, 'seconds'),
      },
      {
        Icon: SkipForwardIcon,
        onClick: () => skipVideoTime(1, 'subtitles', 10, 'seconds'),
      },
      {
        Icon: ChevronsUpIcon,
        onClick: increaseSpeed,
      },
      {
        Icon: ChevronsDownIcon,
        onClick: decreaseSpeed,
      },
      {
        Icon: RepeatIcon,
        onClick: () => loopController.toggleLoop(),
        className: isLooping ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
      {
        Icon: ScanEyeIcon,
        onClick: () => useFocusModeStore.getState().toggle(),
        className: isFocusMode ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
      {
        Icon: ZapIcon,
        onClick: () => (isGapSkipping ? gapSkipper.stop() : gapSkipper.start()),
        className: isGapSkipping ? 'text-teal-500 hover:text-teal-400' : undefined,
      },
    ],
    [isLooping, isFocusMode, isGapSkipping, increaseSpeed, decreaseSpeed]
  );

  return (
    <div
      className={cn(
        'absolute top-1/2 right-0 shadow-lg rounded-lg select-none pointer-events-auto flex items-center bg-black/50 hover:bg-black/80 transition-all duration-300',
        isFocusMode ? '-translate-y-[calc(100%+80px)]' : '-translate-y-1/2',
        className
      )}
    >
      {isExpanded &&
        buttonList.map((button, index) => (
          <IconButton key={index} Icon={button.Icon} onClick={button.onClick} className={button.className} />
        ))}

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
