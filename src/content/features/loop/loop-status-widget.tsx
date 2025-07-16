import { formatTime } from '@utils/helper';

import { useLoopStore } from '@/content/features/loop/loop-store';
import { cn } from '@/ui/lib/utils';

export function LoopStatus() {
  const isLooping = useLoopStore((state) => state.isLooping);
  const startTime = useLoopStore((state) => state.startTime);
  const endTime = useLoopStore((state) => state.endTime);

  if (!isLooping && startTime === 0 && endTime === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute top-4 right-4 font-bold rounded py-2 px-3',
        isLooping ? 'text-white bg-black/80 backdrop-blur-sm' : 'text-white/50 bg-black/20'
      )}
    >
      <div className='flex items-center gap-2'>
        <span>{formatTime(startTime)}</span>
        <span>~</span>
        <span>{formatTime(endTime)}</span>
      </div>
    </div>
  );
}
