import { SETTINGS } from '@utils/constants';
import LoopConfigForm from '../components/form/loop-config-form';
import ShortcutsConfigForm from '../components/form/shortcuts-config-form';
import VideoSkipConfigForm from '../components/form/video-skip-config-form';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

function VideoSettingPage() {
  return (
    <div className='flex flex-col gap-5 p-4'>
      <VideoSkipConfigForm {...VIDEO_SKIP} />
      <VideoSkipConfigForm {...SUB_VIDEO_SKIP} />
      <ShortcutsConfigForm />
      <LoopConfigForm />
    </div>
  );
}

export default VideoSettingPage;
