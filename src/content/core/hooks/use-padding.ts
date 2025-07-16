import { useEffect, useState } from 'react';

import { calculatePadding } from '@/content/core/utils/dom';

export function usePadding() {
  const [padding, setPadding] = useState({ paddingX: 0, paddingY: 0 });

  useEffect(() => {
    const handleResize = () => {
      const { innerWidth, innerHeight } = window;
      const padding = calculatePadding(innerWidth, innerHeight);
      setPadding(padding);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return padding;
}
