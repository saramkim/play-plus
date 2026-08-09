import { useMemo, useState } from 'react';

import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import {
  BookmarkPlusIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
  EyeIcon,
  EyeOffIcon,
  Minimize2Icon,
  Repeat1Icon,
  RotateCcwIcon,
  SkipBackIcon,
  SkipForwardIcon,
  SlidersVerticalIcon,
} from 'lucide-react';

import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { useVideoControlStore, videoController } from '@/content/features/video/video-controller';

const BUTTON_SIZE = 40;

export function Controller({ className }: { className?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const missionActive = useListeningMissionActiveStore((state) => state.active);
  const playbackSpeed = useVideoControlStore((state) => state.playbackSpeed);
  const ready = useVideoControlStore((state) => state.ready);
  const supportLanguage = useSubtitleStore((state) => state.learningProfile.supportLanguage);
  const supportVisibility = useSubtitleStore(
    (state) => state.subtitleDisplay.support.visibility
  );
  const speed = usePlaybackSpeedStore.getState();
  const buttons = useMemo(() => [
    { title: t('v2_previous_learning_cue'), Icon: SkipBackIcon, onClick: () => void videoController.execute('previous') },
    { title: t('v2_next_learning_cue'), Icon: SkipForwardIcon, onClick: () => void videoController.execute('next') },
    { title: t('v2_repeat_current_learning_cue'), Icon: Repeat1Icon, onClick: () => void videoController.execute('repeat-current') },
    { title: t('v2_save_learning_card'), Icon: BookmarkPlusIcon, onClick: () => void videoController.execute('save') },
    {
      title:
        supportVisibility === 'visible'
          ? t('v2_hide_support_subtitle')
          : t('show_support_subtitle'),
      Icon: supportVisibility === 'visible' ? EyeOffIcon : EyeIcon,
      disabled: supportLanguage === null,
      onClick: (): void => {
        void videoController.toggleSupportSubtitleVisibility();
      },
    },
    ...(playbackSpeed.enabled
      ? [
          { title: t('increase_speed'), Icon: ChevronsUpIcon, onClick: speed.increaseSpeed },
          { title: t('decrease_speed'), Icon: ChevronsDownIcon, onClick: speed.decreaseSpeed },
          { title: t('reset_speed'), Icon: RotateCcwIcon, onClick: speed.resetSpeed },
        ]
      : []),
  ], [playbackSpeed.enabled, speed.decreaseSpeed, speed.increaseSpeed, speed.resetSpeed, supportLanguage, supportVisibility]);

  if (!ready || missionActive) return null;
  return (
    <div className={cn('absolute top-1/2 right-0 flex -translate-y-1/2 items-center rounded-lg bg-black/50 shadow-lg transition-all hover:bg-black/80 pointer-events-auto', className)}>
      {isExpanded && buttons.map((button) => <IconButton key={button.title} {...button} />)}
      <IconButton
        title={isExpanded ? t('v2_hide_learning_controls') : t('v2_show_learning_controls')}
        Icon={isExpanded ? Minimize2Icon : SlidersVerticalIcon}
        onClick={() => setIsExpanded((value) => !value)}
      />
    </div>
  );
}

function IconButton({ Icon, className, ...props }: { Icon: React.ElementType } & React.ComponentProps<'button'>) {
  return (
    <button
      type='button'
      className={cn('flex cursor-pointer items-center justify-center text-white/70 hover:text-white', className)}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
      {...props}
    >
      <Icon className='size-5' />
    </button>
  );
}
