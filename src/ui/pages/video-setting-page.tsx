import { SETTINGS } from '@utils/constants';

import { LoopConfigForm } from '@/ui/components/form/loop-config-form';
import { ShortcutsConfigForm } from '@/ui/components/form/shortcuts-config-form';
import { VideoSkipConfigForm } from '@/ui/components/form/video-skip-config-form';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

export function VideoSettingPage() {
  return (
    <div className='flex flex-col gap-5 p-4'>
      <VideoSkipConfigForm {...VIDEO_SKIP} />
      <VideoSkipConfigForm {...SUB_VIDEO_SKIP} />
      <ShortcutsConfigForm />
      <LoopConfigForm />
    </div>
  );
}
