import ShortcutsConfigForm from './ShortcutsConfigForm';
import VideoSkipConfigForm from './VideoSkipConfigForm';
import { SETTINGS } from '../utils/constants';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

function VideoSettingPage() {
  return (
    <div className='flex flex-col gap-5'>
      <VideoSkipConfigForm {...VIDEO_SKIP} />
      <VideoSkipConfigForm {...SUB_VIDEO_SKIP} />
      <ShortcutsConfigForm />
    </div>
  );
}

export default VideoSettingPage;
