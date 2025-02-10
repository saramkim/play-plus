import { useEffect, useState, useRef, useMemo } from 'react';
import SubtitleUploader, { LANGUAGE_OPTIONS } from '../components/SubtitleUploader';
import { getLocalStorage, onLocalStorageChange, setLocalStorage } from '../storage/storage';
import { SubtitleMetadata } from '../storage/type';
import { Language, LANGUAGES, REGISTRATION, SET_SUBTITLE_ACTION, SetSubtitleAction } from '../utils/constants';
import { parseSubtitle, getSubtitleFormat } from '../utils/subtitle';
import { setLocalSubtitle, SubtitleId } from '../storage/subtitle';
import ListHeader from './ListHeader';
import { CheckIcon, XCircleIcon } from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { usePopup } from '../contexts/PopupContext';
import { t } from '../utils/i18n';
import MessagePopup from '../components/MessagePopup';
import { useClickOutside } from '../hooks/useClickOutside';
import DropdownButton from '../components/DropdownButton';
import { sendMessage } from '../utils/message';

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

  const handleUpload = (file: File, title: string, language: Language) => {
    return new Promise<void>((resolve) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = async () => {
        const content = reader.result as string;
        const id = `${ID_PREFIX}-${crypto.randomUUID()}` as const;
        const subtitle = getSubtitle(file, content);
        const newData = { id, title, language, savedAt: new Date().toISOString() };

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
      title: t('delete'),
      content: (
        <MessagePopup
          type='confirm'
          message={t('confirm_delete')}
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

  const editSubtitle = (id: string, title: string, language: Language) => {
    const newSubtitles = subtitles.map((v) => (v.id === id ? { ...v, title, language } : v));
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
  onDelete: (id: SubtitleId) => void;
  onEdit: (id: SubtitleId, title: string, language: Language) => void;
}

function SubtitleItem({ id, title, language, savedAt, onDelete, onEdit }: SubtitleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedLanguage, setEditedLanguage] = useState(language);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsEditing(false));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onEdit(id, editedTitle, editedLanguage);
    setIsEditing(false);
  };

  const setSubtitle = (action: SetSubtitleAction, id: SubtitleId | null) => {
    sendMessage(action, { id });
  };

  return (
    <li key={id} className='flex flex-col gap-2 py-2 border-b'>
      <div ref={containerRef}>
        {isEditing ? (
          <form className='flex items-center gap-1' onSubmit={handleSubmit}>
            <DropdownButton options={LANGUAGE_OPTIONS} value={editedLanguage} onChange={setEditedLanguage} />
            <input className='input' value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
            <button type='submit'>
              <CheckIcon className='size-5 text-gray-500 hover:text-gray-800' />
            </button>
          </form>
        ) : (
          <div className='flex items-center gap-2 group w-fit flex-wrap'>
            <span className='text-[13px] text-gray-500'>{t(LANGUAGES[language])}</span>
            <p className='text-[15px] font-medium text-wrap'>{title}</p>
            <button onClick={() => setIsEditing(true)}>
              <PencilSquareIcon className='size-5 hidden group-hover:block text-gray-500 hover:text-gray-800' />
            </button>
          </div>
        )}
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center gap-1'>
          <button
            className='text-gray-500 hover:text-gray-800'
            onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, id)}
          >
            {t('primary_subtitle')}
          </button>
          <button
            className='text-gray-500 hover:text-gray-800'
            onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_SECONDARY, id)}
          >
            {t('secondary_subtitle')}
          </button>
          <button onClick={() => onDelete(id)}>
            <XCircleIcon className='size-5 text-gray-500 hover:text-gray-800' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

export default SubtitleRegistrationPage;
