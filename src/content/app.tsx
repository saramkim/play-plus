import { useRef, useEffect } from 'react';

import ReactDOM from 'react-dom/client';

import { cn } from '@/ui/lib/utils';

import { Controller } from './components/controller';
import { FocusMode } from './components/focus-mode';
import { LoopStatus } from './components/loop-status';
import { PlaybackSpeedDisplay } from './components/playback-speed-display';
import { ToastContainer } from './components/toast';
import { useAutoHide } from './hooks/use-auto-hide';
import { usePadding } from './hooks/use-padding';
import { elementStore } from './store/element-store';
import { useFocusModeStore } from './store/focus-mode-store';

function App() {
  const isFocusMode = useFocusModeStore((state) => state.isFocusMode);
  const containerRef = useRef<HTMLDivElement>(null);
  const subtitleMountRef = useRef<HTMLDivElement>(null);
  const isVisible = useAutoHide(containerRef);
  const { paddingX, paddingY } = usePadding();

  useEffect(() => {
    const subtitleContainer = elementStore.getSubtitleContainer();
    if (subtitleContainer && subtitleMountRef.current) {
      subtitleMountRef.current.appendChild(subtitleContainer);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className='absolute'
      style={{ top: paddingY, bottom: paddingY, left: paddingX, right: paddingX }}
    >
      <div className='relative size-full pointer-events-none z-[9999]'>
        <Controller className={cn(isVisible ? 'opacity-100' : 'opacity-0', 'transition-opacity duration-300')} />
        <LoopStatus />
        <PlaybackSpeedDisplay />
        <ToastContainer />
        <div ref={subtitleMountRef} />
        {isFocusMode && <FocusMode />}
      </div>
    </div>
  );
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
