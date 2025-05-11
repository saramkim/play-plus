import { useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { SubtitleMetadata } from '@storage/type';
import { Language, LANGUAGES, SET_SUBTITLE_ACTION } from '@utils/constants';
import { t } from '@utils/i18n';
import { BookOpenTextIcon, CaptionsIcon, PencilIcon, Trash2Icon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { SubtitleEditForm } from '@/ui/features/subtitle/subtitle-edit-form';
import { SubtitleUploader } from '@/ui/features/subtitle/subtitle-uploader';
import { useRegisteredSubtitles } from '@/ui/features/subtitle/use-registered-subtitles';
import { useSubtitleSettings } from '@/ui/features/subtitle/use-subtitle-settings';
import { useTabInfo } from '@/ui/hooks/use-tab-info';
import { cn } from '@/ui/lib/utils';
import { usePageStore } from '@/ui/store/page-store';

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
  const setPage = usePageStore((state) => state.setPage);

  const isPrimarySubtitle = tabInfo?.primarySubtitle === id;
  const isSecondarySubtitle = tabInfo?.secondarySubtitle === id;

  return (
    <li key={id} className='flex flex-col gap-[6px] py-2 border-b'>
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
          <div className='flex items-center gap-[6px] group w-fit flex-wrap min-h-6'>
            <span className='text-[13px] text-gray-500'>{t(LANGUAGES[language])}</span>
            <p className='text-[15px] font-medium text-wrap'>{title}</p>
            <Button
              variant='ghost'
              size='xxs'
              tooltip={t('edit')}
              className='hidden group-hover:inline-flex'
              onClick={() => setIsEditing(true)}
            >
              <PencilIcon />
            </Button>
          </div>
        )}
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center'>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('subtitle_analysis')}
            onClick={() => setPage('subtitle-analysis', { id })}
          >
            <BookOpenTextIcon className='size-5' />
          </Button>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('primary_subtitle')}
            className={cn(isPrimarySubtitle && 'text-primary!')}
            disabled={!isAvailable}
            onClick={() => useAsSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, isPrimarySubtitle ? null : id)}
          >
            <CaptionsIcon className='size-5' />
          </Button>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('secondary_subtitle')}
            className={cn(isSecondarySubtitle && 'text-primary!')}
            disabled={!isAvailable}
            onClick={() => useAsSubtitle(SET_SUBTITLE_ACTION.SET_SECONDARY, isSecondarySubtitle ? null : id)}
          >
            <CaptionsIcon className='size-5' />
          </Button>
          <Button variant='ghost' size='xxs' tooltip={t('delete')} onClick={() => onDelete(id)}>
            <Trash2Icon />
          </Button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}
