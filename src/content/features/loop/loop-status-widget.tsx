import { cn, formatTime } from '@utils/helper';
import { Repeat1Icon, RepeatIcon } from 'lucide-react';

import { useLoopStore } from '@/content/features/loop/loop-store';

export function LoopStatus() {
  const isLooping = useLoopStore((state) => state.isLooping);
  const startTime = useLoopStore((state) => state.startTime);
  const endTime = useLoopStore((state) => state.endTime);
  const loopType = useLoopStore((state) => state.loopType);

  if (!isLooping && startTime === 0 && endTime === 0) {
    return null;
  }

  const Icon = loopType === 'manual' ? RepeatIcon : Repeat1Icon;

  return (
    <div className='absolute top-4 right-4'>
      <div
        className={cn(
          'font-bold rounded py-2 px-3',
          isLooping ? 'text-white bg-black/80 backdrop-blur-sm' : 'text-white/50 bg-black/20'
        )}
      >
        <div className='flex items-center gap-2 min-h-5'>
          {isLooping && <Icon className='size-5' />}
          <span>{formatTime(startTime)}</span>
          <span>~</span>
          <span>{formatTime(endTime)}</span>
        </div>
      </div>
    </div>
  );
}
