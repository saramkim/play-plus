import { PlayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { setLocalStorage } from '@storage/index';
import { SavedSubtitle } from '@storage/type';
import { COUPANG_PLAY_BASE_URL, REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';
import { useState } from 'react';
import MessagePopup from '../components/elements/MessagePopup';
import ListHeader from '../components/layout/ListHeader';
import { usePopup } from '../contexts/PopupContext';
import { useSubtitles } from 'ui/hooks/useSubtitles';

const { STORAGE_KEY } = REVIEW;

function ReviewPage() {
  const [filteredSubtitles, setFilteredSubtitles] = useState<SavedSubtitle[]>([]);
  const { subtitles } = useSubtitles('savedSubtitles');
  const { showPopup, hidePopup } = usePopup();

  const deleteSubtitle = (content: string) => {
    showPopup({
      title: t('delete'),
      content: (
        <MessagePopup
          type='confirm'
          message={t('confirm_delete')}
          onConfirm={() => {
            const filtered = subtitles.filter((v) => v.content !== content);
            setLocalStorage(STORAGE_KEY, filtered);
          }}
          hidePopup={hidePopup}
        />
      ),
      status: 'confirm',
    });
  };

  return (
    <div className='flex flex-col h-full px-4 pt-4'>
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='content' />
      {subtitles.length > 0 ? (
        <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
          {filteredSubtitles.map((item) => SubtitleItem({ ...item, onDelete: deleteSubtitle }))}
        </ul>
      ) : (
        <div className='flex flex-col justify-center items-center h-full gap-2'>
          <p className='text-gray-500'>{t('no_saved_subtitles')}</p>
          <p className='text-gray-500'>{t('no_saved_subtitles_description')}</p>
        </div>
      )}
    </div>
  );
}

interface SubtitleItemProps extends SavedSubtitle {
  onDelete: (content: string) => void;
}

function SubtitleItem({ content, savedAt, url, startTime, onDelete }: SubtitleItemProps) {
  const viewVideo = () => {
    sendMessage('viewVideo', { url, startTime });
  };

  return (
    <li key={content} className='flex flex-col gap-[6px] py-2 border-b'>
      <div className='flex items-center'>
        <p className='text-[15px] font-medium text-wrap select-text w-full'>{content}</p>
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center gap-1'>
          <button className='icon-button' disabled={!url.startsWith(COUPANG_PLAY_BASE_URL)} onClick={viewVideo}>
            <PlayIcon
              title={url.startsWith(COUPANG_PLAY_BASE_URL) ? t('view_video') : t('error_unsupported_url')}
              className='size-5'
            />
          </button>
          <button className='icon-button' onClick={() => onDelete(content)}>
            <TrashIcon title={t('delete')} className='size-5' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

export default ReviewPage;
