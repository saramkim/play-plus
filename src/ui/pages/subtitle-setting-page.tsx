import { SETTINGS } from '@utils/constants';

import { SubtitleConfigForm } from '@/ui/features/subtitle/subtitle-config-form';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

export function SubtitleSettingPage() {
  return (
    <div className='flex flex-col gap-3 p-3'>
      <SubtitleConfigForm {...PRIMARY} defaultExpanded />
      <SubtitleConfigForm {...SECONDARY} />
    </div>
  );
}
