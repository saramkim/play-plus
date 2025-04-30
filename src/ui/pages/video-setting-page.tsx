import { SETTINGS } from '@utils/constants';

import { LoopConfigForm } from '@/ui/features/loop/loop-config-form';
import { ShortcutsConfigForm } from '@/ui/features/video/shortcuts-config-form';
import { VideoSkipConfigForm } from '@/ui/features/video/video-skip-config-form';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

export function VideoSettingPage() {
  return (
    <div className='flex flex-col gap-4 p-4'>
      <VideoSkipConfigForm {...VIDEO_SKIP} />
      <VideoSkipConfigForm {...SUB_VIDEO_SKIP} />
      <ShortcutsConfigForm />
      <LoopConfigForm />
    </div>
  );
}
