import { useState } from 'react';

import { t } from '@utils/i18n';
import { FileUpIcon, SearchIcon } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/ui/components/toggle-group';

import { OpenSubtitlesSearch } from './open-subtitles-search';
import { SubtitleUploader } from './subtitle-uploader';

type SubtitleSource = 'file' | 'online';

export function SubtitleAdder() {
  const [source, setSource] = useState<SubtitleSource>('file');

  return (
    <section className='flex min-w-0 flex-col gap-2'>
      <ToggleGroup
        type='single'
        value={source}
        variant='outline'
        size='sm'
        className='w-full'
        aria-label={t('subtitle_add_source')}
        onValueChange={(value) => {
          if (value === 'file' || value === 'online') setSource(value);
        }}
      >
        <ToggleGroupItem className='min-w-0 flex-1' value='file' aria-label={t('add_from_file')}>
          <FileUpIcon />
          {t('add_from_file')}
        </ToggleGroupItem>
        <ToggleGroupItem className='min-w-0 flex-1' value='online' aria-label={t('find_online')}>
          <SearchIcon />
          {t('find_online')}
        </ToggleGroupItem>
      </ToggleGroup>

      {source === 'file' ? <SubtitleUploader /> : <OpenSubtitlesSearch onAdded={() => setSource('file')} />}
    </section>
  );
}
