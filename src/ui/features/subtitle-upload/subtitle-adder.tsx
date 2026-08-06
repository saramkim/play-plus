import { useEffect, useRef, useState } from 'react';

import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { t } from '@utils/i18n';
import { FileUpIcon, SearchIcon } from 'lucide-react';

import { ToggleGroup, ToggleGroupItem } from '@/ui/components/toggle-group';

import { OpenSubtitlesSearch } from './open-subtitles-search';
import { SubtitleUploader } from './subtitle-uploader';

export type SubtitleAddSource = 'file' | 'online';

interface SubtitleAdderProps {
  initialSource?: SubtitleAddSource;
  focusFirstControl?: boolean;
  onAdded: (subtitle: V2RegisteredSubtitleMetadata) => void;
  onBusyChange: (busy: boolean) => void;
}

export function SubtitleAdder({
  initialSource = 'file',
  focusFirstControl = false,
  onAdded,
  onBusyChange,
}: SubtitleAdderProps) {
  const [source, setSource] = useState<SubtitleAddSource>(initialSource);
  const [fileBusy, setFileBusy] = useState(false);
  const [onlineBusy, setOnlineBusy] = useState(false);
  const fileSourceRef = useRef<HTMLButtonElement>(null);
  const onlineSourceRef = useRef<HTMLButtonElement>(null);
  const previousSourceRef = useRef(source);
  const busy = fileBusy || onlineBusy;

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (previousSourceRef.current === source) return;
    previousSourceRef.current = source;
    (source === 'file' ? fileSourceRef.current : onlineSourceRef.current)?.focus();
  }, [source]);

  return (
    <section className='flex min-w-0 flex-col gap-2'>
      <ToggleGroup
        type='single'
        value={source}
        variant='outline'
        size='sm'
        className='w-full'
        aria-label={t('subtitle_add_source')}
        disabled={busy}
        onValueChange={(value) => {
          if (value === 'file' || value === 'online') setSource(value);
        }}
      >
        <ToggleGroupItem
          ref={fileSourceRef}
          className='min-w-0 flex-1'
          value='file'
          aria-label={t('add_from_file')}
        >
          <FileUpIcon />
          {t('add_from_file')}
        </ToggleGroupItem>
        <ToggleGroupItem
          ref={onlineSourceRef}
          className='min-w-0 flex-1'
          value='online'
          aria-label={t('find_online')}
        >
          <SearchIcon />
          {t('find_online')}
        </ToggleGroupItem>
      </ToggleGroup>

      <div hidden={source !== 'file'}>
        <SubtitleUploader
          focusOnMount={focusFirstControl && initialSource === 'file'}
          onAdded={onAdded}
          onBusyChange={setFileBusy}
        />
      </div>
      <div hidden={source !== 'online'}>
        <OpenSubtitlesSearch
          focusOnMount={focusFirstControl && initialSource === 'online'}
          onAdded={onAdded}
          onBusyChange={setOnlineBusy}
        />
      </div>
    </section>
  );
}
