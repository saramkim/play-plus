import { useEffect, useRef, useState } from 'react';

import { usePlaybackSpeedStore } from '@/content/store/playback-speed-store';

export function PlaybackSpeedDisplay() {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSpeed = usePlaybackSpeedStore((state) => state.currentSpeed);

  useEffect(() => {
    if (currentSpeed === 1.0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    } else {
      setIsVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [currentSpeed]);

  if (!isVisible) return null;

  return (
    <div className='absolute top-4 left-4 text-white font-bold bg-black/50 rounded py-1 px-2'>
      <span>{currentSpeed.toFixed(1)}x</span>
    </div>
  );
}
