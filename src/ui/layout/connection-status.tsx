
import { type ComponentType, useEffect, useState } from 'react';

import { COUPANG_PLAY_BASE_URL, COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { sendMessageToTab } from '@utils/message';
import type { PlaybackContextStatus } from '@utils/playback-context';
import { Link2, Link2Off, Loader2, Video, VideoOff } from 'lucide-react';

import { useTabStore } from '@/ui/store/tab-store';

export function ConnectionStatus() {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const playbackContext = useTabStore((state) => state.playbackContext);
  const tabUrl = activeTab?.url;
  const isCoupangPlay = Boolean(tabUrl?.startsWith(COUPANG_PLAY_BASE_URL));
  const isVideoUrl = Boolean(tabUrl && COUPANG_PLAY_VIDEO_URL_LIST.some((url) => tabUrl.startsWith(url)));
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

  const { connectionStatus, videoStatus, shouldReloadTab, shouldDetectVideo } = deriveStatus({
    isCoupangPlay,
    isVideoUrl,
    tabInfo,
    isConnecting,
    isDetecting,
  });

  const handleReloadClick = async () => {
    if (!shouldReloadTab) return;
    const tabId = activeTab?.id;
    if (!tabId) return;

    setIsConnecting(true);
    chrome.tabs.reload(tabId);
  };

  const handleDetectClick = async () => {
    if (!shouldDetectVideo) return;
    const tabId = activeTab?.id;
    if (!tabId) return;

    try {
      setIsDetecting(true);
      await sendMessageToTab(tabId, 'detectVideo');
    } finally {
      setIsDetecting(false);
    }
  };

  const connectionLabel = getConnectionLabel(isCoupangPlay, connectionStatus);
  const videoLabel = getVideoLabel(isCoupangPlay, videoStatus, playbackContext);

  return (
    <div className='flex items-center h-8 border-b px-2 text-xs text-muted-foreground bg-background'>
      <div className='flex items-center gap-2 min-w-0'>
        <StatusLabel
          text={connectionLabel.text}
          tone={connectionLabel.tone}
          title={connectionLabel.title}
          icon={connectionLabel.icon}
          spin={connectionLabel.spin}
          onClick={shouldReloadTab ? handleReloadClick : undefined}
          disabled={isConnecting}
        />
        <StatusLabel
          text={videoLabel.text}
          tone={videoLabel.tone}
          title={videoLabel.title}
          icon={videoLabel.icon}
          spin={videoLabel.spin}
          onClick={shouldDetectVideo ? handleDetectClick : undefined}
          disabled={isDetecting}
        />
      </div>
    </div>
  );
}

type DerivedStatus = {
  connectionStatus: ConnectionStatusState;
  videoStatus: VideoStatusState;
  shouldReloadTab: boolean;
  shouldDetectVideo: boolean;
};

function deriveStatus({
  isCoupangPlay,
  isVideoUrl,
  tabInfo,
  isConnecting,
  isDetecting,
}: {
  isCoupangPlay: boolean;
  isVideoUrl: boolean;
  tabInfo: {
    connectionStatus?: ConnectionStatusState;
    videoStatus?: VideoStatusState;
  } | null;
  isConnecting: boolean;
  isDetecting: boolean;
}): DerivedStatus {
  const baseConnectionStatus = isCoupangPlay ? tabInfo?.connectionStatus ?? 'connecting' : 'idle';
  const connectionStatus = isConnecting ? 'connecting' : baseConnectionStatus;
  const baseVideoStatus =
    connectionStatus === 'connected' && isVideoUrl ? tabInfo?.videoStatus ?? 'detecting' : 'idle';
  const videoStatus = isDetecting ? 'detecting' : baseVideoStatus;

  return {
    connectionStatus,
    videoStatus,
    shouldReloadTab: isCoupangPlay && connectionStatus === 'disconnected',
    shouldDetectVideo: isCoupangPlay && connectionStatus === 'connected' && isVideoUrl && videoStatus === 'not_detected',
  };
}

type LabelTone = 'primary' | 'warning' | 'danger' | 'muted';

type StatusIcon = ComponentType<{ className?: string }>;

type StatusLabelConfig = {
  text: string;
  title: string;
  tone: LabelTone;
  icon: StatusIcon;
  spin?: boolean;
};

type StatusLabelProps = StatusLabelConfig & {
  onClick?: () => void;
  disabled?: boolean;
};

function StatusLabel({ text, title, tone, icon: Icon, spin, onClick, disabled }: StatusLabelProps) {
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors max-w-[140px]',
    getToneClasses(tone),
    onClick && !disabled ? 'cursor-pointer hover:bg-muted/60' : 'cursor-default',
    disabled && 'cursor-not-allowed opacity-60 pointer-events-none'
  );
  const iconClassName = cn('size-3.5', spin && 'animate-spin');

  if (onClick) {
    return (
      <button
        type='button'
        title={title}
        onClick={onClick}
        disabled={disabled}
        aria-disabled={disabled}
        className={className}
      >
        <Icon className={iconClassName} />
        <span className='truncate'>{text}</span>
      </button>
    );
  }

  return (
    <span title={title} aria-disabled={disabled} className={className}>
      <Icon className={iconClassName} />
      <span className='truncate'>{text}</span>
    </span>
  );
}

function getToneClasses(tone: LabelTone) {
  switch (tone) {
    case 'primary':
      return 'text-primary border-primary/30 bg-primary/10';
    case 'warning':
      return 'text-yellow-800 border-yellow-100 bg-yellow-50';
    case 'danger':
      return 'text-destructive border-destructive/30 bg-destructive/10';
    default:
      return 'text-muted-foreground border-border bg-muted/40';
  }
}

function getConnectionLabel(isCoupangPlay: boolean, contentStatus: ConnectionStatusState): StatusLabelConfig {
  if (!isCoupangPlay) {
    return {
      text: t('connection_label_not_coupang'),
      title: t('connection_not_coupang_tab'),
      tone: 'muted',
      icon: Link2Off,
    };
  }

  if (contentStatus === 'connecting') {
    return {
      text: t('connection_label_connecting'),
      title: t('connection_content_connecting'),
      tone: 'warning',
      icon: Loader2,
      spin: true,
    };
  }

  if (contentStatus === 'disconnected') {
    return {
      text: t('connection_label_disconnected'),
      title: t('connection_content_disconnected'),
      tone: 'danger',
      icon: Link2Off,
    };
  }

  return {
    text: t('connection_label_connected'),
    title: t('connection_content_connected'),
    tone: 'primary',
    icon: Link2,
  };
}

function getVideoLabel(
  isCoupangPlay: boolean,
  videoStatus: VideoStatusState,
  playbackContext: PlaybackContextStatus | null
): StatusLabelConfig {
  if (!isCoupangPlay || videoStatus === 'idle') {
    return {
      text: t('connection_label_video_idle'),
      title: t('connection_video_idle'),
      tone: 'muted',
      icon: Video,
    };
  }

  if (videoStatus === 'detecting') {
    return {
      text: t('connection_label_video_detecting'),
      title: t('connection_video_detecting'),
      tone: 'warning',
      icon: Loader2,
      spin: true,
    };
  }

  if (playbackContext?.lifecycle === 'advertisement') {
    return {
      text: t('connection_label_video_advertisement'),
      title: t('connection_video_advertisement'),
      tone: 'warning',
      icon: VideoOff,
    };
  }

  if (playbackContext?.lifecycle === 'transitioning') {
    return {
      text: t('connection_label_video_transitioning'),
      title: t('connection_video_transitioning'),
      tone: 'warning',
      icon: Loader2,
      spin: true,
    };
  }

  if (playbackContext?.lifecycle === 'waiting' || playbackContext?.lifecycle === 'placeholder') {
    return {
      text: t(
        playbackContext.lifecycle === 'waiting'
          ? 'connection_label_video_waiting'
          : 'connection_label_video_placeholder'
      ),
      title: t(
        playbackContext.lifecycle === 'waiting'
          ? 'connection_video_waiting'
          : 'connection_video_placeholder'
      ),
      tone: 'warning',
      icon: Loader2,
      spin: true,
    };
  }

  if (
    playbackContext?.lifecycle === 'content' &&
    (playbackContext.routeKind === 'trailer' ||
      playbackContext.routeKind === 'channel' ||
      playbackContext.routeKind === 'highlight' ||
      playbackContext.routeKind === 'unknown')
  ) {
    return {
      text: t('connection_label_video_learning_unavailable'),
      title: t('connection_video_learning_unavailable'),
      tone: 'muted',
      icon: VideoOff,
    };
  }

  if (videoStatus === 'detected') {
    return {
      text: t('connection_label_video_detected'),
      title: t('connection_video_detected'),
      tone: 'primary',
      icon: Video,
    };
  }

  return {
    text: t('connection_label_video_not_detected'),
    title: t('connection_video_not_detected'),
    tone: 'danger',
    icon: VideoOff,
  };
}

type ConnectionStatusState = 'idle' | 'connecting' | 'connected' | 'disconnected';
type VideoStatusState = 'idle' | 'detecting' | 'detected' | 'not_detected';
