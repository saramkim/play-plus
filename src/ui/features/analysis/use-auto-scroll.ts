import { useEffect, useState } from 'react';

export function useAutoScroll(activeIndex: number, scrollToFn: (index: number) => void, enabled = true) {
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const pauseFollowing = () => setIsAutoScrolling(false);

  useEffect(() => {
    if (isAutoScrolling && enabled) {
      scrollToFn(Math.floor(activeIndex) + 1);
    }
  }, [activeIndex, isAutoScrolling, scrollToFn, enabled]);

  return { isAutoScrolling, setIsAutoScrolling, pauseFollowing };
}
