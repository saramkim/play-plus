import { SETTINGS } from '@utils/constants';

import { SubtitleConfigForm } from '@/ui/features/subtitle/subtitle-config-form';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

export function SubtitleSettingPage() {
  return (
    <div className='flex flex-col gap-4 p-4'>
      <SubtitleConfigForm {...PRIMARY} />
      <SubtitleConfigForm {...SECONDARY} />
    </div>
  );
}
