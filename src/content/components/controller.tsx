import { useState, useMemo } from 'react';

import {
  Minimize2Icon,
  SlidersVerticalIcon,
  SkipBackIcon,
  SkipForwardIcon,
  ChevronsUpIcon,
  ChevronsDownIcon,
  RepeatIcon,
} from 'lucide-react';

import { loopController } from '@/content/features/loop';
import { skipVideoTime } from '@/content/features/video/video-navigation';
import { useLoopStore } from '@/content/store/loop-store';
import { usePlaybackSpeedStore } from '@/content/store/playback-speed-store';
import { cn } from '@/ui/lib/utils';

const BUTTON_SIZE = 40;

export function Controller({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLooping = useLoopStore((state) => state.isLooping);
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
        className: isLooping ? 'text-teal-500 hover:text-teal-500' : undefined,
      },
    ],
    [isLooping, increaseSpeed, decreaseSpeed]
  );

  return (
    <div
      className={cn(
        'absolute top-1/2 right-0 -translate-y-1/2 shadow-lg rounded-lg select-none pointer-events-auto flex items-center bg-neutral-800/80',
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
      className={cn(
        'text-neutral-300 hover:text-neutral-100 cursor-pointer flex items-center justify-center',
        className
      )}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
      {...props}
    >
      <Icon className='size-5' />
    </button>
  );
}
