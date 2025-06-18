import { formatTime } from '@utils/helper';

import { useLoopStore } from '@/content/store/loop-store';

export function LoopStatus() {
  const isLooping = useLoopStore((state) => state.isLooping);
  const startTime = useLoopStore((state) => state.startTime);
  const endTime = useLoopStore((state) => state.endTime);

  if (!isLooping) {
    return null;
  }

  return (
    <div className='absolute top-4 right-4 text-white font-bold bg-black/50 rounded py-1 px-2'>
      <div className='flex items-center gap-2'>
        <span>{formatTime(startTime)}</span>
        <span>~</span>
        <span>{formatTime(endTime)}</span>
      </div>
    </div>
  );
}
