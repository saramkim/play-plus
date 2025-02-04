import { useEffect } from 'react';

export const useClickOutside = (ref: React.RefObject<HTMLElement | null>, callback: () => void) => {
  const handleClickOutside = (e: MouseEvent) => {
    if (ref.current && !e.composedPath().includes(ref.current)) {
      callback();
    }
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
};
