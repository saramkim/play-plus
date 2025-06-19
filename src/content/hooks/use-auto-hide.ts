import { useEffect, useRef, useState, useCallback } from 'react';

export function useAutoHide(containerRef: React.RefObject<HTMLElement | null>, hideDelay = 3000) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const clearTimeout = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    setIsVisible(true);
    clearTimeout();
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, hideDelay);
  }, [hideDelay, clearTimeout]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const rect = rectRef.current;
      if (!rect) return;

      const isInside =
        e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (isInside) {
        show();
      }
    },
    [show]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateRect = () => {
      rectRef.current = container.getBoundingClientRect();
    };

    const resizeObserver = new ResizeObserver(updateRect);

    updateRect();
    resizeObserver.observe(container);
    window.addEventListener('scroll', updateRect, true);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  return isVisible;
}
