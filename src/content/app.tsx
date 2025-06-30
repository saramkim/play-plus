import { useRef } from 'react';

import ReactDOM from 'react-dom/client';

import { cn } from '@/ui/lib/utils';

import { Controller } from './components/controller';
import { LoopStatus } from './components/loop-status';
import { PlaybackSpeedDisplay } from './components/playback-speed-display';
import { ToastContainer } from './components/toast';
import { useAutoHide } from './hooks/use-auto-hide';
import { usePadding } from './hooks/use-padding';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useAutoHide(containerRef);
  const { paddingX, paddingY } = usePadding();

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
      </div>
    </div>
  );
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
