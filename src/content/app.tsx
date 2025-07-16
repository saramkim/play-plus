import { useRef } from 'react';

import ReactDOM from 'react-dom/client';

import { cn } from '@/ui/lib/utils';

import { Controller } from './components/controller';
import { LoopStatus } from './components/loop-status';
import { PlaybackSpeedDisplay } from './components/playback-speed-display';
import { Subtitles } from './components/subtitles';
import { ToastContainer } from './components/toast';
import { useAutoHide } from './hooks/use-auto-hide';
import { Container } from './layout/container';

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
        <Subtitles />
      </div>
    </Container>
  );
}

export const renderApp = (container: HTMLElement) => {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
};
