import { useEffect, useState } from 'react';

import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';
import { PLATFORM_MAP } from '@utils/platform';

import { useTabStore } from '@/ui/store/tab-store';

export function ConnectionStatus() {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const isCoupangPlay = Boolean(activeTab?.url?.startsWith(PLATFORM_MAP.coupangPlay.url));
  const isVideoUrl = Boolean(activeTab?.url?.startsWith(PLATFORM_MAP.coupangPlay.videoUrl));
  const tabTitle = activeTab?.title ?? t('connection_no_tab');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!isCoupangPlay) {
      setIsDetecting(false);
      setIsConnecting(false);
      return;
    }

    if (tabInfo?.connectionStatus === 'connected' || tabInfo?.connectionStatus === 'disconnected') {
      setIsConnecting(false);
    }

    if (tabInfo?.videoStatus && tabInfo.videoStatus !== 'detecting') {
      setIsDetecting(false);
    }
  }, [isCoupangPlay, tabInfo?.connectionStatus, tabInfo?.videoStatus]);

  const connectionStatus = isCoupangPlay ? tabInfo?.connectionStatus ?? 'connecting' : 'idle';
  const effectiveConnectionStatus = isConnecting ? 'connecting' : connectionStatus;
  const baseVideoStatus =
    effectiveConnectionStatus === 'connected' && isVideoUrl ? tabInfo?.videoStatus ?? 'detecting' : 'idle';
  const effectiveVideoStatus = isDetecting ? 'detecting' : baseVideoStatus;

  const shouldReloadTab = isCoupangPlay && effectiveConnectionStatus === 'disconnected';
  const shouldDetectVideo =
    isCoupangPlay && effectiveConnectionStatus === 'connected' && isVideoUrl && effectiveVideoStatus === 'not_detected';

  const handleSyncClick = async () => {
    const tabId = activeTab?.id;
    if (!tabId) return;

    if (shouldReloadTab) {
      setIsConnecting(true);
      chrome.tabs.reload(tabId);
      return;
    }

    if (shouldDetectVideo) {
      try {
        setIsDetecting(true);
        await sendMessageToTab(tabId, 'detectVideo');
      } catch (error) {
        setIsDetecting(false);
      } finally {
        setIsDetecting(false);
      }
    }
  };

  const statusText = getStatusText(isCoupangPlay, effectiveConnectionStatus, effectiveVideoStatus);
  const statusClassName = getStatusTextClass(isCoupangPlay, effectiveConnectionStatus, effectiveVideoStatus);

  return (
    <div className='flex items-center justify-between h-8 border-b px-2 text-xs text-gray-600 bg-gray-50'>
      <div className='flex items-center gap-2 min-w-0'>
        <span className={cn('font-medium', statusClassName)}>{statusText}</span>
        {(shouldReloadTab || shouldDetectVideo) && (
          <button
            type='button'
            onClick={handleSyncClick}
            disabled={isDetecting}
            className={cn(
              'shrink-0 rounded px-2 py-0.5 text-[11px] font-medium border border-primary/30',
              isDetecting
                ? 'text-primary/60 bg-primary/5 cursor-not-allowed'
                : 'text-primary hover:bg-primary/10'
            )}
          >
            {shouldReloadTab ? t('connection_sync_reload') : t('connection_sync_detect')}
          </button>
        )}
      </div>
      <div className='flex items-center gap-2 min-w-0'>
        <span className='truncate'>{t('connection_current_tab', tabTitle)}</span>
      </div>
    </div>
  );
}

function getStatusText(isCoupangPlay: boolean, contentStatus: ConnectionStatusState, videoStatus: VideoStatusState) {
  if (!isCoupangPlay) return t('connection_not_coupang_tab');
  if (contentStatus === 'connecting') return t('connection_content_connecting');
  if (contentStatus === 'disconnected') return t('connection_content_disconnected');

  const contentText = t('connection_content_connected');
  const videoText = getVideoText(videoStatus);

  return videoText ? `${contentText} · ${videoText}` : contentText;
}

function getStatusTextClass(isCoupangPlay: boolean, contentStatus: ConnectionStatusState, videoStatus: VideoStatusState) {
  if (!isCoupangPlay) return 'text-gray-500';
  if (contentStatus === 'connecting') return 'text-amber-600';
  if (contentStatus === 'disconnected') return 'text-rose-600';
  if (videoStatus === 'detected') return 'text-emerald-600';
  if (videoStatus === 'detecting' || videoStatus === 'not_detected') return 'text-amber-600';
  return 'text-rose-600';
}

function getVideoText(videoStatus: VideoStatusState) {
  if (videoStatus === 'detecting') return t('connection_video_detecting');
  if (videoStatus === 'detected') return t('connection_video_detected');
  if (videoStatus === 'not_detected') return t('connection_video_not_detected');
  return null;
}

type ConnectionStatusState = 'idle' | 'connecting' | 'connected' | 'disconnected';
type VideoStatusState = 'idle' | 'detecting' | 'detected' | 'not_detected';
