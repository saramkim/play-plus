import { useEffect } from 'react';

export const useClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: React.RefObject<T | null> | React.RefObject<T | null>[],
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
