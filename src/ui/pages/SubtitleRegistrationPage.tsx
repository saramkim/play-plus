import { CheckIcon, PencilSquareIcon, LinkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { setLocalStorage } from '@storage/index';
import { removeLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { TabInfo, updateTabInfo } from '@storage/tab';
import { SubtitleMetadata } from '@storage/type';
import {
  COUPANG_PLAY_PLAY_URL,
  Language,
  LANGUAGES,
  REGISTRATION,
  SET_SUBTITLE_ACTION,
  SET_SUBTITLE_STORAGE_KEY_MAP,
  SetSubtitleAction,
} from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';
import { useRef, useState } from 'react';
import { useSubtitles } from 'ui/hooks/useSubtitles';
import { useTabInfo } from 'ui/hooks/useTabInfo';
import MessagePopup from '../components/elements/MessagePopup';
import SubtitleUploader, { LANGUAGE_OPTIONS } from '../components/form/SubtitleUploader';
import ListHeader from '../components/layout/ListHeader';
import { usePopup } from '../contexts/PopupContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { Input } from '../components/elements/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const { STORAGE_KEY } = REGISTRATION;

function SubtitleRegistrationPage() {
  const { activeTab, tabInfo } = useTabInfo();
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleMetadata[]>([]);
  const { subtitles } = useSubtitles('registeredSubtitles');
  const { showPopup, hidePopup } = usePopup();

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
          <footer className='border-t border-gray-200 pt-4'>
            <SubtitleUploader />
          </footer>
        </>
      ) : (
        <div className='flex flex-col justify-center h-full'>
          <SubtitleUploader />
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
  const containerRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  const { showPopup, hidePopup } = usePopup();

  const available = activeTab?.url?.startsWith(COUPANG_PLAY_PLAY_URL);
  const isPrimarySubtitle = tabInfo?.primarySubtitle === id;
  const isSecondarySubtitle = tabInfo?.secondarySubtitle === id;

  useClickOutside([containerRef, selectRef], () => setIsEditing(false));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onEdit(id, editedTitle, editedLanguage);
    setIsEditing(false);
  };

  const setSubtitle = async (action: SetSubtitleAction, subtitleId: SubtitleId | null) => {
    const tabId = activeTab?.id;
    if (!tabId) return;

    const response = await sendMessage(action, { tabId, subtitleId });
    if (response.success) {
      updateTabInfo(tabId, { [SET_SUBTITLE_STORAGE_KEY_MAP[action]]: subtitleId });
    } else {
      showPopup({
        title: t('error'),
        content: <MessagePopup message={response.message} type='alert' hidePopup={hidePopup} />,
        status: 'error',
      });
    }
  };

  return (
    <li key={id} className='flex flex-col gap-2 py-2 border-b border-gray-200'>
      <div ref={containerRef}>
        {isEditing ? (
          <form className='flex items-center gap-1' onSubmit={handleSubmit}>
            <Select value={editedLanguage} onValueChange={(value) => setEditedLanguage(value as Language)}>
              <SelectTrigger className='w-fit'>
                <SelectValue placeholder={t('language')} />
              </SelectTrigger>
              <SelectContent ref={selectRef}>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
            <button type='submit' className='icon-button'>
              <CheckIcon className='size-5' />
            </button>
          </form>
        ) : (
          <div className='flex items-center gap-2 group w-fit flex-wrap'>
            <span className='text-[13px] text-gray-500'>{t(LANGUAGES[language])}</span>
            <p className='text-[15px] font-medium text-wrap'>{title}</p>
            <button className='icon-button hidden group-hover:block' onClick={() => setIsEditing(true)}>
              <PencilSquareIcon className='size-5' />
            </button>
          </div>
        )}
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center gap-1'>
          <button
            className={`icon-button ${isPrimarySubtitle ? 'text-primary!' : ''}`}
            disabled={!available}
            onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, isPrimarySubtitle ? null : id)}
          >
            <LinkIcon title={available ? t('primary_subtitle') : t('available_on_coupang_play')} className='size-5' />
          </button>
          <button
            className={`icon-button ${isSecondarySubtitle ? 'text-primary!' : ''}`}
            disabled={!available}
            onClick={() => setSubtitle(SET_SUBTITLE_ACTION.SET_SECONDARY, isSecondarySubtitle ? null : id)}
          >
            <LinkIcon title={available ? t('secondary_subtitle') : t('available_on_coupang_play')} className='size-5' />
          </button>
          <button className='icon-button' onClick={() => onDelete(id)}>
            <TrashIcon title={t('delete')} className='size-5' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

export default SubtitleRegistrationPage;
