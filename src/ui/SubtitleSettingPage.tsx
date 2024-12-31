import { SETTINGS } from '../utils/constants';
import SubtitleConfigForm from './SubtitleConfigForm';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

function SubtitleSettingPage() {
  return (
    <div className='flex flex-col gap-5'>
      <SubtitleConfigForm {...PRIMARY} />
      <SubtitleConfigForm {...SECONDARY} />
    </div>
  );
}

export default SubtitleSettingPage;
