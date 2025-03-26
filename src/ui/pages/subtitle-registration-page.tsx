import { useState } from 'react';

import { PencilSquareIcon, LinkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { SubtitleMetadata } from '@storage/schema';
import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { Language, LANGUAGES, SET_SUBTITLE_ACTION } from '@utils/constants';
import { t } from '@utils/i18n';

import { ListHeader } from '@/ui/features/subtitle/list-header';
import { SubtitleEditForm } from '@/ui/features/subtitle/subtitle-edit-form';
import { SubtitleUploader } from '@/ui/features/subtitle/subtitle-uploader';
import { useRegisteredSubtitles } from '@/ui/features/subtitle/use-registered-subtitles';
import { useSubtitleSettings } from '@/ui/features/subtitle/use-subtitle-settings';
import { useTabInfo } from '@/ui/hooks/use-tab-info';

export function SubtitleRegistrationPage() {
  const { activeTab, tabInfo } = useTabInfo();
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleMetadata[]>([]);
  const { subtitles, editSubtitle, deleteSubtitle } = useRegisteredSubtitles();

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
  const { useAsSubtitle, isAvailable } = useSubtitleSettings(activeTab);

  const isPrimarySubtitle = tabInfo?.primarySubtitle === id;
  const isSecondarySubtitle = tabInfo?.secondarySubtitle === id;

  return (
    <li key={id} className='flex flex-col gap-2 py-2 border-b'>
      <div>
        {isEditing ? (
          <SubtitleEditForm
            id={id}
            initialTitle={title}
            initialLanguage={language}
            onEdit={onEdit}
            closeEditMode={() => setIsEditing(false)}
          />
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
            disabled={!isAvailable}
            onClick={() => useAsSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, isPrimarySubtitle ? null : id)}
          >
            <LinkIcon title={isAvailable ? t('primary_subtitle') : t('available_on_coupang_play')} className='size-5' />
          </button>
          <button
            className={`icon-button ${isSecondarySubtitle ? 'text-primary!' : ''}`}
            disabled={!isAvailable}
            onClick={() => useAsSubtitle(SET_SUBTITLE_ACTION.SET_SECONDARY, isSecondarySubtitle ? null : id)}
          >
            <LinkIcon
              title={isAvailable ? t('secondary_subtitle') : t('available_on_coupang_play')}
              className='size-5'
            />
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
