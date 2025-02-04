import { useEffect, useState, useRef, useMemo } from 'react';
import SubtitleUploader from '../components/SubtitleUploader';
import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '../storage/storage';
import { SubtitleMetadata } from '../storage/type';
import { REGISTRATION } from '../utils/constants';
import { parseSubtitle, getSubtitleFormat } from '../utils/subtitle';
import { setLocalSubtitle } from '../storage/subtitle';
import ListHeader from './ListHeader';
import { CheckIcon, XCircleIcon } from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { usePopup } from '../contexts/PopupContext';
import { getMessage } from '../utils/i18n';
import MessagePopup from '../components/MessagePopup';
import { useClickOutside } from '../hooks/useClickOutside';

const { STORAGE_KEY, ID_PREFIX } = REGISTRATION;

function SubtitleRegistrationPage() {
  const [subtitles, setSubtitles] = useState<SubtitleMetadata[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');
  const { showPopup, hidePopup } = usePopup();

  const filteredSubtitles = useMemo(() => {
    const filtered = searchText
      ? subtitles.filter(({ title }) => title.toLowerCase().includes(searchText.toLowerCase()))
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
      const change = changes[STORAGE_KEY];
      if (change?.newValue) setSubtitles(change.newValue);
    });
  };

  const handleUpload = (file: File, title: string) => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = async () => {
        const content = reader.result as string;
        const id = `${ID_PREFIX}-${crypto.randomUUID()}` as const;
        const subtitle = getSubtitle(file, content);
        const newData = { id, title, savedAt: new Date().toISOString() };
        console.log(subtitle);

        await Promise.all([setLocalSubtitle(id, subtitle), setLocalStorage(STORAGE_KEY, [...subtitles, newData])]);
        resolve();
      };
    });
  };

  const getSubtitle = (file: File, content: string) => {
    const fileExtension = getSubtitleFormat(file);
    if (!fileExtension) return [];
    return parseSubtitle[fileExtension](content);
  };

  const deleteSubtitle = (id: string) => {
    showPopup({
      title: getMessage('delete'),
      content: (
        <MessagePopup
          type='confirm'
          message={getMessage('confirm_delete')}
          onConfirm={() => {
            const filtered = subtitles.filter((v) => v.id !== id);
            setLocalStorage(STORAGE_KEY, filtered);
          }}
          hidePopup={hidePopup}
        />
      ),
      status: 'confirm',
    });
  };

  const editSubtitle = (id: string, title: string) => {
    const newSubtitles = subtitles.map((v) => (v.id === id ? { ...v, title } : v));
    setLocalStorage(STORAGE_KEY, newSubtitles);
  };

  return (
    <div className='flex flex-col h-full p-4'>
      <ListHeader
        searchText={searchText}
        setSearchText={setSearchText}
        count={subtitles.length}
        sort={sort}
        setSort={setSort}
      />
      {subtitles.length > 0 ? (
        <>
          <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
            {filteredSubtitles.map((item) => (
              <SubtitleItem key={item.id} {...item} onDelete={deleteSubtitle} onEdit={editSubtitle} />
            ))}
          </ul>
          <footer className='border-t pt-4'>
            <SubtitleUploader onUpload={handleUpload} />
          </footer>
        </>
      ) : (
        <div className='flex flex-col justify-center h-full'>
          <SubtitleUploader onUpload={handleUpload} />
        </div>
      )}
    </div>
  );
}

interface SubtitleItemProps extends SubtitleMetadata {
  onDelete: (id: string) => void;
  onEdit: (id: string, title: string) => void;
}

function SubtitleItem({ id, title, savedAt, onDelete, onEdit }: SubtitleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsEditing(false));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onEdit(id, editedTitle);
    setIsEditing(false);
  };

  return (
    <li key={id} className='flex flex-col gap-2 py-2 border-b'>
      <div ref={containerRef}>
        {isEditing ? (
          <form className='flex items-center gap-2' onSubmit={handleSubmit}>
            <input className='input' value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
            <button type='submit'>
              <CheckIcon className='size-5 text-gray-500 hover:text-gray-800' />
            </button>
          </form>
        ) : (
          <div className='flex items-center gap-2 group w-fit'>
            <p className='text-[15px] font-medium text-wrap'>{title}</p>
            <button onClick={() => setIsEditing(true)}>
              <PencilSquareIcon className='size-5 hidden group-hover:block text-gray-500 hover:text-gray-800' />
            </button>
          </div>
        )}
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center gap-1 text-gray-500 disabled:opacity-30'>
          <button onClick={() => onDelete(id)}>
            <XCircleIcon className='size-5 hover:text-gray-800' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

export default SubtitleRegistrationPage;
