import { useState } from 'react';

import { PlayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { SavedSubtitle } from '@storage/type';
import { COUPANG_PLAY_PLAY_URL } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';

import { CopyButton } from '@/ui/components/copy-button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { useSavedSubtitle } from '@/ui/features/subtitle/use-saved-subtitle';

export function ReviewPage() {
  const [filteredSubtitles, setFilteredSubtitles] = useState<SavedSubtitle[]>([]);
  const { subtitles, deleteSubtitle } = useSavedSubtitle();

  return (
    <div className='flex flex-col h-full px-4 pt-4'>
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='content' />
      {subtitles.length > 0 ? (
        <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
          {filteredSubtitles.map((item) => (
            <SubtitleItem key={item.content} {...item} onDelete={deleteSubtitle} />
          ))}
        </ul>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className='flex flex-col justify-center items-center h-full gap-2'>
      <p className='text-gray-500'>{t('no_saved_subtitles')}</p>
      <p className='text-gray-500'>{t('no_saved_subtitles_description')}</p>
    </div>
  );
}

interface SubtitleItemProps extends SavedSubtitle {
  onDelete: (content: string) => void;
}

function SubtitleItem({ content, savedAt, url, startTime, onDelete }: SubtitleItemProps) {
  return (
    <li key={content} className='flex flex-col gap-[6px] py-2 border-b'>
      <div className='flex items-center'>
        <p className='text-[15px] font-medium text-wrap select-text w-full'>{content}</p>
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center gap-1'>
          <button
            className='icon-button'
            disabled={!url.startsWith(COUPANG_PLAY_PLAY_URL)}
            onClick={() => sendMessage('viewVideo', { url, startTime })}
          >
            <PlayIcon
              title={url.startsWith(COUPANG_PLAY_PLAY_URL) ? t('view_video') : t('error_unsupported_url')}
              className='size-5'
            />
          </button>
          <CopyButton content={content} />
          <button className='icon-button' onClick={() => onDelete(content)}>
            <TrashIcon title={t('delete')} className='size-5' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}
