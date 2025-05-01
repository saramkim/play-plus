import { useEffect, useRef, useState } from 'react';

export const useAutoScroll = (activeIndex: number) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const activeSubtitleRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (autoScroll) {
      activeSubtitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, autoScroll]);

  return { autoScroll, setAutoScroll, activeSubtitleRef };
};
