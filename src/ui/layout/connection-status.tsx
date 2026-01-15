import { useEffect, useRef, useState } from 'react';

import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';
import { PLATFORM_MAP } from '@utils/platform';

import { useTabStore } from '@/ui/store/tab-store';

export function ConnectionStatus() {
  const activeTab = useTabStore((state) => state.activeTab);
  const isCoupangPlay = Boolean(activeTab?.url?.startsWith(PLATFORM_MAP.coupangPlay.url));
  const tabTitle = activeTab?.title ?? t('connection_no_tab');
  const [contentStatus, setContentStatus] = useState<ConnectionStatusState>('idle');
  const [hasVideo, setHasVideo] = useState(false);
  const statusRef = useRef<ConnectionStatusState>('idle');
  const hasVideoRef = useRef(false);

  useEffect(() => {
    statusRef.current = contentStatus;
  }, [contentStatus]);

  useEffect(() => {
    hasVideoRef.current = hasVideo;
  }, [hasVideo]);

  useEffect(() => {
    const tabId = activeTab?.id;

    if (!tabId || !isCoupangPlay) {
      setContentStatus('idle');
      setHasVideo(false);
      return;
    }

    setContentStatus('checking');
    setHasVideo(false);

    let isCancelled = false;
    const checkConnection = async () => {
      if (!tabId) return;
      try {
        const response = await sendMessageToTab(tabId, 'pingContent');
        if (isCancelled) return;
        const nextStatus: ConnectionStatusState = response.success ? 'connected' : 'disconnected';
        if (statusRef.current !== nextStatus) setContentStatus(nextStatus);
        if (response.success && response.data) {
          if (hasVideoRef.current !== response.data.hasVideo) {
            setHasVideo(response.data.hasVideo);
          }
        } else if (hasVideoRef.current) {
          setHasVideo(false);
        }
      } catch (error) {
        if (isCancelled) return;
        if (statusRef.current !== 'disconnected') setContentStatus('disconnected');
        if (hasVideoRef.current) setHasVideo(false);
      }
    };

    checkConnection();
    const intervalId = window.setInterval(checkConnection, 2000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeTab?.id, isCoupangPlay]);

  return (
    <div className='flex items-center justify-between h-8 border-b px-2 text-xs text-gray-600 bg-gray-50'>
      <span className={cn('font-medium', getStatusTextClass(isCoupangPlay, contentStatus, hasVideo))}>
        {getStatusText(isCoupangPlay, contentStatus, hasVideo)}
      </span>
      <span className='truncate'>{t('connection_current_tab', tabTitle)}</span>
    </div>
  );
}

function getStatusText(isCoupangPlay: boolean, status: ConnectionStatusState, hasVideo: boolean) {
  if (!isCoupangPlay) return t('connection_not_coupang_tab');
  if (status === 'checking') return t('connection_checking');
  if (status === 'connected') {
    return hasVideo ? t('connection_video_detected') : t('connection_video_not_detected');
  }
  return t('connection_content_disconnected');
}

function getStatusTextClass(isCoupangPlay: boolean, status: ConnectionStatusState, hasVideo: boolean) {
  if (!isCoupangPlay) return 'text-gray-500';
  if (status === 'connected') return hasVideo ? 'text-emerald-600' : 'text-amber-600';
  if (status === 'checking') return 'text-amber-600';
  return 'text-rose-600';
}

type ConnectionStatusState = 'idle' | 'checking' | 'connected' | 'disconnected';
