import { useState } from 'react';

import { SavedSubtitle } from '@storage/type';
import { COUPANG_PLAY_PLAY_URL } from '@utils/constants';
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
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='content' />
      <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
        {filteredSubtitles.map((item) => (
          <SubtitleItem key={item.content} {...item} onDelete={deleteSubtitle} />
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
  onDelete: (content: string) => void;
}

function SubtitleItem({ content, savedAt, url, startTime, onDelete }: SubtitleItemProps) {
  return (
    <li key={content} className='flex flex-col gap-[6px] py-2 border-b'>
      <div className='flex items-center select-text w-full min-h-6'>
        <p className='text-[15px] font-medium text-wrap'>{content}</p>
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center'>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('view_video')}
            disabled={!url.startsWith(COUPANG_PLAY_PLAY_URL)}
            onClick={() => sendMessage('viewVideo', { url, startTime })}
          >
            <PlayIcon />
          </Button>
          <CopyButton content={content} />
          <Button variant='ghost' size='xxs' tooltip={t('delete')} onClick={() => onDelete(content)}>
            <Trash2Icon />
          </Button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}
