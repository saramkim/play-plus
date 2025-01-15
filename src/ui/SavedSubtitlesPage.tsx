import { useEffect, useMemo, useRef, useState } from 'react';
import { COUPANG_PLAY_BASE_URL, REVIEW } from '../utils/constants';
import { getMessage } from '../utils/i18n';
import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '../storage/storage';
import { SavedSubtitle } from '../storage/type';

const { STORAGE_KEY, ACTIONS } = REVIEW;

function SavedSubtitlesPage() {
  const [subtitles, setSubtitles] = useState<SavedSubtitle[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const originalSubtitles = useRef<SavedSubtitle[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
      if (data) {
        setSubtitles(data);
        originalSubtitles.current = data;
      }
    })();

    const { remove } = setupStorageListener();
    return () => remove();
  }, []);

  const setupStorageListener = () => {
    return onLocalStorageChange((changes) => {
      const reviewChanges = changes[STORAGE_KEY];
      if (reviewChanges?.newValue) {
        const newSubtitles = reviewChanges.newValue;
        originalSubtitles.current = newSubtitles;
        setSubtitles(newSubtitles);
      }
    });
  };

  const deleteSubtitle = (content: string) => {
    const newSubtitles = subtitles.filter((subtitle: SavedSubtitle) => subtitle.content !== content);
    setSubtitles(newSubtitles);
  };

  const enterEditMode = () => {
    setIsEditMode(true);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setSubtitles(originalSubtitles.current);
  };

  const saveSubtitles = async () => {
    if (subtitles.length < originalSubtitles.current.length) {
      await setLocalStorage(STORAGE_KEY, subtitles);
      setIsEditMode(false);
    } else {
      exitEditMode();
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const text = searchInputRef.current?.value.trim() || '';
    setSearchText(text);
  };

  const clearSearch = () => {
    setSearchText('');
  };

  return (
    <div className='flex flex-col h-full'>
      <header className='flex flex-col gap-2 pb-2 border-b'>
        <div className='flex justify-between items-center gap-2'>
          <form className='flex items-center gap-1' onSubmit={search}>
            <input className='input' ref={searchInputRef} />
            <button className='button bg-teal-500' type='submit'>
              {getMessage('search')}
            </button>
          </form>
          <div className='flex gap-1'>
            {isEditMode ? (
              <>
                <button className='button bg-gray-500' onClick={exitEditMode}>
                  {getMessage('cancel')}
                </button>
                <button className='button bg-teal-500' onClick={saveSubtitles}>
                  {getMessage('save')}
                </button>
              </>
            ) : (
              <button className='button bg-gray-500' onClick={enterEditMode}>
                {getMessage('edit')}
              </button>
            )}
          </div>
        </div>
        <div className='flex justify-between items-center gap-2'>
          {searchText ? (
            <div className='flex items-center gap-1 w-full overflow-hidden'>
              <button className='text-rose-500' onClick={clearSearch}>
                ✖
              </button>
              <span className='text-gray-800'>{getMessage('search_term')}:</span>
              <span className='font-bold truncate'>{searchText}</span>
            </div>
          ) : (
            <div className='text-gray-800'>
              <span className='font-medium'>{getMessage('all_list')}</span>
              <span>({subtitles.length})</span>
            </div>
          )}

          <div className='flex items-center gap-1'>
            <button className={sort === 'latest' ? 'font-bold' : 'text-gray-500'} onClick={() => setSort('latest')}>
              {getMessage('latest')}
            </button>
            <span className='text-gray-300'>|</span>
            <button className={sort === 'oldest' ? 'font-bold' : 'text-gray-500'} onClick={() => setSort('oldest')}>
              {getMessage('oldest')}
            </button>
          </div>
        </div>
      </header>
      <ul className='flex flex-col h-full overflow-auto'>
        {filteredSubtitles.map((item) => SubtitleItem({ ...item, isEditMode, onDlete: deleteSubtitle }))}
      </ul>
    </div>
  );
}

interface SubtitleItemProps extends SavedSubtitle {
  isEditMode: boolean;
  onDlete: (content: string) => void;
}

function SubtitleItem({ content, savedAt, url, startTime, isEditMode, onDlete }: SubtitleItemProps) {
  const viewVideo = () => {
    chrome.runtime.sendMessage({ action: ACTIONS.VIEW_VIDEO, url, startTime });
  };

  return (
    <li key={content} className='flex flex-col gap-2 py-2 border-b'>
      <div className='flex justify-between items-center'>
        <p className='text-[15px] font-medium text-wrap select-text w-full'>{content}</p>
        {isEditMode && (
          <button className='text-rose-500 font-bold' onClick={() => onDlete(content)}>
            ✖
          </button>
        )}
      </div>
      <div className='flex justify-between items-center'>
        <button
          className='bg-gray-200 px-1 rounded disabled:opacity-30'
          disabled={!url.startsWith(COUPANG_PLAY_BASE_URL)}
          onClick={viewVideo}
        >
          {getMessage('view_video')}
        </button>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

export default SavedSubtitlesPage;
