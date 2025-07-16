import { useEffect, useRef } from 'react';

import { elementStore } from '@/content/core/store/element-store';

export function SubtitleContainer() {
  const subtitleMountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const subtitleContainer = elementStore.getSubtitleContainer();
    if (subtitleContainer && subtitleMountRef.current) {
      subtitleMountRef.current.appendChild(subtitleContainer);
    }
  }, []);

  return <div ref={subtitleMountRef} />;
}
