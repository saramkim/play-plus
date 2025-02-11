import { PlayCircleIcon, XCircleIcon } from '@heroicons/react/20/solid';
import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '@storage/index';
import { SavedSubtitle } from '@storage/type';
import { COUPANG_PLAY_BASE_URL, REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';
import { useEffect, useMemo, useState } from 'react';
import MessagePopup from '../components/elements/MessagePopup';
import ListHeader from '../components/layout/ListHeader';
import { usePopup } from '../contexts/PopupContext';

const { STORAGE_KEY } = REVIEW;

function ReviewPage() {
  const [subtitles, setSubtitles] = useState<SavedSubtitle[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const { showPopup, hidePopup } = usePopup();

  const filteredSubtitles = useMemo(() => {
    const filtered = searchText
      ? subtitles.filter(({ content }) => content.toLowerCase().includes(searchText.toLowerCase()))
      : subtitles;
    return sort === 'latest'
      ? filtered.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      : filtered.sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
  }, [subtitles, searchText, sort]);

  useEffect(() => {
    (async () => {
      const data = await getLocalStorage(STORAGE_KEY);
      if (data) setSubtitles(data);
    })();

    const { remove } = setupStorageListener();
    return () => remove();
  }, []);

  const setupStorageListener = () => {
    return onLocalStorageChange((changes) => {
      const reviewChanges = changes[STORAGE_KEY];
      if (reviewChanges?.newValue) setSubtitles(reviewChanges.newValue);
    });
  };

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
      <ListHeader
        searchText={searchText}
        setSearchText={setSearchText}
        count={subtitles.length}
        sort={sort}
        setSort={setSort}
      />
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
        <div className='flex items-center gap-1 text-gray-500 disabled:opacity-30'>
          <button onClick={viewVideo} disabled={!url.startsWith(COUPANG_PLAY_BASE_URL)}>
            <PlayCircleIcon className='size-5 hover:text-gray-800' />
          </button>
          <button onClick={() => onDelete(content)}>
            <XCircleIcon className='size-5 hover:text-gray-800' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

export default ReviewPage;
