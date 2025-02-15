import { CheckIcon, XCircleIcon } from '@heroicons/react/20/solid';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { setLocalStorage } from '@storage/index';
import { removeLocalSubtitle, setLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import {
  COUPANG_PLAY_BASE_URL,
  Language,
  LANGUAGES,
  REGISTRATION,
  SET_SUBTITLE_ACTION,
  SET_SUBTITLE_STORAGE_KEY_MAP,
  SetSubtitleAction,
} from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';
import { getSubtitleFormat, parseSubtitle } from '@utils/subtitle';
import { useEffect, useRef, useState } from 'react';
import DropdownButton from '../components/elements/DropdownButton';
import MessagePopup from '../components/elements/MessagePopup';
import SubtitleUploader, { LANGUAGE_OPTIONS } from '../components/form/SubtitleUploader';
import ListHeader from '../components/layout/ListHeader';
import { usePopup } from '../contexts/PopupContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { updateTabInfo, TabInfo } from '@storage/tab';
import { useTabInfo } from 'ui/hooks/useTabInfo';
import { useSubtitles } from 'ui/hooks/useSubtitles';

const { STORAGE_KEY, ID_PREFIX } = REGISTRATION;

function SubtitleRegistrationPage() {
  const { activeTab, tabInfo } = useTabInfo();
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleMetadata[]>([]);
  const { subtitles } = useSubtitles('registeredSubtitles');
  const { showPopup, hidePopup } = usePopup();

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

  const deleteSubtitle = (id: SubtitleId) => {
    showPopup({
      title: t('delete'),
      content: (
        <MessagePopup
          type='confirm'
          message={t('confirm_delete')}
          onConfirm={() => {
            const filtered = subtitles.filter((v) => v.id !== id);
            setLocalStorage(STORAGE_KEY, filtered);
            removeLocalSubtitle(id);
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
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='title' />

      {subtitles.length > 0 ? (
        <>
          <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
            {filteredSubtitles.map((item) => (
              <SubtitleItem
                key={item.id}
                {...item}
                activeTab={activeTab}
                tabInfo={tabInfo}
                onDelete={deleteSubtitle}
                onEdit={editSubtitle}
              />
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
  activeTab: chrome.tabs.Tab | null;
  tabInfo: TabInfo | null;
  onDelete: (id: SubtitleId) => void;
  onEdit: (id: SubtitleId, title: string, language: Language) => void;
}

function SubtitleItem({ id, title, language, savedAt, activeTab, tabInfo, onDelete, onEdit }: SubtitleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedLanguage, setEditedLanguage] = useState(language);
  const [primarySubtitle, setPrimarySubtitle] = useState<SubtitleId | null>(tabInfo?.primarySubtitle ?? null);
  const [secondarySubtitle, setSecondarySubtitle] = useState<SubtitleId | null>(tabInfo?.secondarySubtitle ?? null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { showPopup, hidePopup } = usePopup();

  useClickOutside(containerRef, () => setIsEditing(false));

  useEffect(() => {
    if (tabInfo) {
      setPrimarySubtitle(tabInfo.primarySubtitle ?? null);
      setSecondarySubtitle(tabInfo.secondarySubtitle ?? null);
    }
  }, [tabInfo]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onEdit(id, editedTitle, editedLanguage);
    setIsEditing(false);
  };

  const setSubtitleMap = {
    [SET_SUBTITLE_ACTION.SET_PRIMARY]: setPrimarySubtitle,
    [SET_SUBTITLE_ACTION.SET_SECONDARY]: setSecondarySubtitle,
  };

  const setSubtitle = async (action: SetSubtitleAction, subtitleId: SubtitleId | null) => {
    const tabId = activeTab?.id;
    if (!tabId) return;

    const response = await sendMessage(action, { tabId, subtitleId });
    if (response.success) {
      updateTabInfo(tabId, { [SET_SUBTITLE_STORAGE_KEY_MAP[action]]: subtitleId });
      setSubtitleMap[action](subtitleId);
    } else {
      showPopup({
        title: t('error'),
        content: <MessagePopup message={response.message} type='alert' hidePopup={hidePopup} />,
        status: 'error',
      });
    }
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
          {activeTab?.url?.startsWith(COUPANG_PLAY_BASE_URL) && (
            <>
              {primarySubtitle === id ? (
                <button
                  className='bg-gray-100 hover:text-gray-800'
                  onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, null)}
                >
                  {t('primary_subtitle')} X
                </button>
              ) : (
                <button
                  className='text-gray-500 hover:text-gray-800'
                  onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, id)}
                >
                  {t('primary_subtitle')}
                </button>
              )}
              {secondarySubtitle === id ? (
                <button
                  className='bg-gray-100 hover:text-gray-800'
                  onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_SECONDARY, null)}
                >
                  {t('secondary_subtitle')} X
                </button>
              ) : (
                <button
                  className='text-gray-500 hover:text-gray-800'
                  onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_SECONDARY, id)}
                >
                  {t('secondary_subtitle')}
                </button>
              )}
            </>
          )}
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
