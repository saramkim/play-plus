import { useEffect, useRef, useState } from 'react';

export const useAutoScroll = (activeIndex: number) => {
  const [autoScroll, setAutoScroll] = useState(true);
  const activeSubtitleRef = useRef<HTMLLIElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScrollEnd = () => {
      if (!isAutoScrolling.current) setAutoScroll(false);
      isAutoScrolling.current = false;
    };

    container.addEventListener('scrollend', handleScrollEnd);
    return () => container.removeEventListener('scrollend', handleScrollEnd);
  }, [containerRef.current]);

  useEffect(() => {
    if (autoScroll) {
      isAutoScrolling.current = true;
      activeSubtitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, autoScroll]);

  return { autoScroll, setAutoScroll, activeSubtitleRef, containerRef };
};
