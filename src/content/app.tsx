import { useRef } from 'react';

import { cn } from '@utils/helper';
import ReactDOM from 'react-dom/client';

import { Container } from './core/components/container';
import { Controller } from './core/components/controller';
import { ToastContainer } from './core/components/toast';
import { useAutoHide } from './core/hooks/use-auto-hide';
import { LoopStatus } from './features/loop/loop-status-widget';
import { PlaybackSpeedDisplay } from './features/playback-speed/playback-speed-display';
import { SubtitleDisplay } from './features/subtitle/subtitle-display';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useAutoHide(containerRef);

  return (
    <Container ref={containerRef}>
      <div className='relative size-full pointer-events-none z-[9999]'>
        <Controller className={cn(isVisible ? 'opacity-100' : 'opacity-0')} />
        <LoopStatus />
        <PlaybackSpeedDisplay />
        <ToastContainer />
        <SubtitleDisplay />
      </div>
    </Container>
  );
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
