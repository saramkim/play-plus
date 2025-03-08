import { SETTINGS } from '@utils/constants';
import SubtitleConfigForm from '../components/form/subtitle-config-form';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

function SubtitleSettingPage() {
  return (
    <div className='flex flex-col gap-5 p-4'>
      <SubtitleConfigForm {...PRIMARY} />
      <SubtitleConfigForm {...SECONDARY} />
    </div>
  );
}

export default SubtitleSettingPage;
