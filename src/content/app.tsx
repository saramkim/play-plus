import { useRef } from 'react';

import { cn } from '@utils/helper';
import { createPortal } from 'react-dom';
import ReactDOM from 'react-dom/client';

import { Container } from './core/components/container';
import { Controller } from './core/components/controller';
import { ToastContainer } from './core/components/toast';
import { useAutoHide } from './core/hooks/use-auto-hide';
import { LoopStatus } from './features/loop/loop-status-widget';
import { PlaybackSpeedDisplay } from './features/playback-speed/playback-speed-display';
import { SubtitleDisplay } from './features/subtitle/subtitle-display';
import { VideoDetectionBanner } from './features/video/video-detection-banner';

function App({ videoRoot }: { videoRoot: HTMLElement }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useAutoHide(containerRef);

  return (
    <>
      <div className='fixed inset-0 pointer-events-none z-[9999]'>
        <VideoDetectionBanner />
        <ToastContainer />
      </div>
      {createPortal(
        <Container ref={containerRef}>
          <div className='relative size-full pointer-events-none z-[9999]'>
            <Controller className={cn(isVisible ? 'opacity-100' : 'opacity-0')} />
            <LoopStatus />
            <PlaybackSpeedDisplay />
            <SubtitleDisplay />
          </div>
        </Container>,
        videoRoot
      )}
    </>
  );
}

export const renderApp = (systemRoot: HTMLElement, videoRoot: HTMLElement) => {
  const root = ReactDOM.createRoot(systemRoot);
  root.render(<App videoRoot={videoRoot} />);
};
