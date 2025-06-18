import { useState, useEffect } from 'react';

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
import { playbackSpeedController } from '@/content/features/video/playback-speed';
import { skipVideoTime } from '@/content/features/video/video-navigation';
import { useDrag } from '@/content/hooks/use-drag';
import { cn } from '@/ui/lib/utils';

const BUTTON_SIZE = 40;

const buttonList = [
  {
    Icon: SkipBackIcon,
    onClick: () => skipVideoTime(-1, 'subtitles', 10, 'seconds'),
  },
  {
    Icon: SkipForwardIcon,
    onClick: () => skipVideoTime(1, 'subtitles', 10, 'seconds'),
  },
  {
    Icon: ChevronsUpIcon,
    onClick: () => playbackSpeedController.increaseSpeed(),
  },
  {
    Icon: ChevronsDownIcon,
    onClick: () => playbackSpeedController.decreaseSpeed(),
  },
  {
    Icon: RepeatIcon,
    onClick: () => loopController.toggleLoop(),
  },
];

export function Controller() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const { elementRef, handleMouseDown } = useDrag({
    onDrag: (x, y) => setPosition({ x, y }),
  });

  const handleExpand = () => {
    const expandedWidth = buttonList.length * BUTTON_SIZE;

    setPosition((prev) => ({
      ...prev,
      x: isExpanded ? prev.x + expandedWidth : prev.x - expandedWidth,
    }));
    setIsExpanded((prev) => !prev);
  };

  useEffect(() => {
    const handleResize = () => {
      if (!elementRef.current?.parentElement) return;

      const parentRect = elementRef.current.parentElement.getBoundingClientRect();
      const rect = elementRef.current.getBoundingClientRect();

      const maxX = parentRect.width - rect.width;
      const maxY = parentRect.height - rect.height;

      setPosition((prev) => ({
        x: Math.min(Math.max(0, prev.x), maxX),
        y: Math.min(Math.max(0, prev.y), maxY),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={elementRef}
      className='absolute top-0 left-0 shadow-lg rounded-lg z-[9999] select-none overflow-hidden pointer-events-auto'
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        willChange: 'transform',
      }}
    >
      <div className='bg-neutral-800 flex items-center' onMouseDown={handleMouseDown}>
        {isExpanded && (
          <div className='flex items-center'>
            {buttonList.map((button, index) => (
              <IconButton key={index} Icon={button.Icon} onClick={button.onClick} />
            ))}
          </div>
        )}

        <div className='flex items-center'>
          <IconButton Icon={isExpanded ? Minimize2Icon : SlidersVerticalIcon} onClick={handleExpand} />
        </div>
      </div>
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
