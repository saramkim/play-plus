import { useState } from 'react';

import { getSavedSubtitleSearchText } from '@storage/saved-subtitle';
import { SavedSubtitle } from '@storage/type';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message/index';
import { PlayIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { CopyButton } from '@/ui/components/copy-button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { useSavedSubtitle } from '@/ui/features/subtitle/use-saved-subtitle';

export function ReviewPage() {
  const [filteredSubtitles, setFilteredSubtitles] = useState<SavedSubtitle[]>([]);
  const { subtitles, deleteSubtitle, loading } = useSavedSubtitle();

  if (loading) return null;
  if (subtitles.length === 0) return <EmptyState />;

  return (
    <div className='flex flex-col h-full px-4 pt-4'>
      <ListHeader
        originalList={subtitles}
        onFilteredListChange={setFilteredSubtitles}
        getFilterText={getSavedSubtitleSearchText}
      />
      <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
        {filteredSubtitles.map((item) => (
          <SubtitleItem key={item.id} {...item} onDelete={deleteSubtitle} />
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className='h-full flex flex-col justify-center p-4'>
      <p className='text-center text-gray-500'>{t('review_description')}</p>
    </div>
  );
}

interface SubtitleItemProps extends SavedSubtitle {
  onDelete: (id: string) => void;
}

function SubtitleItem({ id, primary, secondary, savedAt, url, startTime, onDelete }: SubtitleItemProps) {
  return (
    <li className='flex min-w-0 flex-col gap-[6px] border-b py-2'>
      <div className='flex min-w-0 select-text flex-col gap-1'>
        <p className='text-wrap text-[15px] font-medium'>{primary.text}</p>
        {secondary && <p className='text-wrap text-[13px] text-muted-foreground'>{secondary.text}</p>}
      </div>
      <div className='flex items-center justify-between gap-2 text-[13px]'>
        <div className='flex shrink-0 items-center'>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('view_video')}
            onClick={() => sendMessage('viewVideo', { url, startTime })}
          >
            <PlayIcon />
          </Button>
          <CopyButton content={primary.text} />
          <Button variant='ghost' size='xxs' tooltip={t('delete')} onClick={() => onDelete(id)}>
            <Trash2Icon />
          </Button>
        </div>
        <p className='min-w-0 truncate text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}
