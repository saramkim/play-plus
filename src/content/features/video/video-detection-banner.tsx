import { useState } from 'react';

import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { useVideoStore } from '@/content/core/store/video-store';
import { retryVideoDetection } from '@/content/message-handler';

export function VideoDetectionBanner() {
  const hasVideo = useVideoStore((state) => state.hasVideo);
  const detectionStatus = useVideoStore((state) => state.detectionStatus);
  const [isDetecting, setIsDetecting] = useState(false);
  const shouldShowBanner = detectionStatus === 'failed';

  if (!shouldShowBanner || hasVideo) return null;

  const handleRetry = async () => {
    if (isDetecting) return;
    try {
      setIsDetecting(true);
      await retryVideoDetection();
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div className='absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-10'>
      <div className='flex items-center gap-2 rounded-full bg-black/70 text-white px-3 py-1 shadow-lg'>
        <span className='text-sm font-medium'>{t('connection_video_not_detected')}</span>
        <button
          type='button'
          onClick={handleRetry}
          disabled={isDetecting}
          className={cn(
            'text-sm font-medium rounded-full px-2 py-1 bg-white/15 hover:bg-white/25',
            isDetecting && 'opacity-60 cursor-not-allowed'
          )}
        >
          {t('connection_sync_detect')}
        </button>
      </div>
    </div>
  );
}
