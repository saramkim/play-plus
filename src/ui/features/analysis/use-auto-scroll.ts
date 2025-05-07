import { useEffect, useRef, useState } from 'react';

export function useAutoScroll(activeIndex: number, scrollToFn: (index: number) => void) {
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const isScrollingRef = useRef(true);

  const handleScroll = () => {
    if (!isScrollingRef.current) setIsAutoScrolling(false);
    isScrollingRef.current = false;
  };

  useEffect(() => {
    if (isAutoScrolling) {
      isScrollingRef.current = true;
      scrollToFn(Math.floor(activeIndex) + 1);
    }
  }, [activeIndex, isAutoScrolling, scrollToFn]);

  return { isAutoScrolling, setIsAutoScrolling, handleScroll };
}
