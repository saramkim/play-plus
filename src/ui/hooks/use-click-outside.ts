import { useEffect } from 'react';

export const useClickOutside = (
  ref: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement | null>[],
  callback: (e: MouseEvent) => void
) => {
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isOutside = Array.isArray(ref)
        ? !ref.some((r) => r.current && e.composedPath().includes(r.current))
        : ref.current && !e.composedPath().includes(ref.current);

      if (isOutside) {
        callback(e);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, callback]);
};
