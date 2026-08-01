
import { useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { SubtitleMetadata } from '@storage/type';
import { Language, LANGUAGES, SET_SUBTITLE_ACTION } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { BookOpenTextIcon, CaptionsIcon, CaptionsOffIcon, Settings2Icon, Trash2Icon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { useSubtitleSettings } from '@/ui/features/subtitle/use-subtitle-settings';
import { SubtitleAdder } from '@/ui/features/subtitle-upload/subtitle-adder';
import { SubtitleDelayForm } from '@/ui/features/subtitle-upload/subtitle-delay-form';
import { SubtitleEditForm } from '@/ui/features/subtitle-upload/subtitle-edit-form';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

export function SubtitleUploadPage() {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleMetadata[]>([]);
  const { subtitles, editSubtitle, updateDelay, deleteSubtitle, loading } = useUploadedSubtitles(activeTab);

  if (loading) return null;
  if (subtitles.length === 0) return <EmptyState />;

  return (
    <div className='flex h-full min-h-0 flex-col p-4'>
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='title' />
      <ul className='flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-1 py-2'>
        {filteredSubtitles.map((item) => (
          <SubtitleItem
            key={item.id}
            data={item}
            activeTab={activeTab}
            tabInfo={tabInfo}
            onDelete={deleteSubtitle}
            onEdit={editSubtitle}
            onUpdateDelay={updateDelay}
          />
        ))}
      </ul>
      <footer className='max-h-[65%] shrink-0 overflow-y-auto border-t pt-4'>
        <SubtitleAdder />
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className='h-full overflow-y-auto p-4'>
      <div className='flex min-h-full flex-col justify-center gap-3'>
        <p className='text-wrap text-center text-gray-500'>{t('subtitle_registration_description')}</p>
        <SubtitleAdder />
      </div>
    </div>
  );
}

interface SubtitleItemProps {
  data: SubtitleMetadata;
  activeTab: chrome.tabs.Tab | null;
  tabInfo: TabInfo | null;
  onDelete: (id: SubtitleId) => void;
  onEdit: (id: SubtitleId, title: string, language: Language) => Promise<void>;
  onUpdateDelay: (id: SubtitleId, delay: number) => Promise<void>;
}

function SubtitleItem({ data, activeTab, tabInfo, onDelete, onEdit, onUpdateDelay }: SubtitleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDelayEditing, setIsDelayEditing] = useState(false);
  const { useAsSubtitle, isAvailable } = useSubtitleSettings(activeTab);
  const setPage = usePageStore((state) => state.setPage);

  const isPrimarySubtitle = tabInfo?.primarySubtitle === data.id;
  const isSecondarySubtitle = tabInfo?.secondarySubtitle === data.id;

  return (
    <li
      className={cn(
        'min-w-0 max-w-full shrink-0 rounded-lg border shadow-sm transition-colors duration-150',
        isPrimarySubtitle || isSecondarySubtitle ? 'bg-primary/20' : 'bg-background'
      )}
    >
      <div className='flex min-w-0 flex-col gap-3 p-3'>
        {isEditing ? (
          <SubtitleEditForm
            id={data.id}
            initialTitle={data.title}
            initialLanguage={data.language}
            onEdit={onEdit}
            closeEditMode={() => setIsEditing(false)}
          />
        ) : (
          <div
            className={cn(
              'flex min-h-6 min-w-0 max-w-full cursor-pointer flex-wrap items-center gap-1 rounded transition-colors duration-150',
              isPrimarySubtitle || isSecondarySubtitle ? 'hover:bg-primary/10' : 'hover:bg-gray-50'
            )}
            onClick={() => setIsEditing(true)}
          >
            <span className='text-[13px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full'>
              {t(LANGUAGES[data.language])}
            </span>
            <p className='min-w-0 max-w-full text-wrap text-[15px] font-medium [overflow-wrap:anywhere]'>
              {data.title}
            </p>
          </div>
        )}

        {isDelayEditing ? (
          <SubtitleDelayForm
            initialDelay={data.delay}
            onUpdateDelay={async (delay) => {
              await onUpdateDelay(data.id, delay);
              setIsDelayEditing(false);
            }}
            closeEditMode={() => setIsDelayEditing(false)}
          />
        ) : (
          <div className='flex justify-between items-center text-[13px]'>
            <div className='flex items-center gap-1'>
              <Button
                variant='ghost'
                size='xxs'
                tooltip={t('subtitle_analysis')}
                onClick={() => setPage('subtitle-analysis', { id: data.id })}
              >
                <BookOpenTextIcon className='size-5' />
              </Button>
              <Button
                variant='ghost'
                size='xxs'
                tooltip={t('primary_subtitle')}
                className={cn(isPrimarySubtitle && 'text-primary!')}
                disabled={!isAvailable}
                onClick={() =>
                  useAsSubtitle(SET_SUBTITLE_ACTION.SET_PRIMARY, isPrimarySubtitle ? null : data.id, data.delay ?? 0)
                }
              >
                {isPrimarySubtitle ? <CaptionsOffIcon className='size-5' /> : <CaptionsIcon className='size-5' />}
              </Button>
              <Button
                variant='ghost'
                size='xxs'
                tooltip={t('secondary_subtitle')}
                className={cn(isSecondarySubtitle && 'text-primary!')}
                disabled={!isAvailable}
                onClick={() =>
                  useAsSubtitle(
                    SET_SUBTITLE_ACTION.SET_SECONDARY,
                    isSecondarySubtitle ? null : data.id,
                    data.delay ?? 0
                  )
                }
              >
                {isSecondarySubtitle ? <CaptionsOffIcon className='size-5' /> : <CaptionsIcon className='size-5' />}
              </Button>
              <Button variant='ghost' size='xxs' tooltip={t('sync_adjustment')} onClick={() => setIsDelayEditing(true)}>
                <Settings2Icon className='size-5' />
              </Button>
              {!isPrimarySubtitle && !isSecondarySubtitle && (
                <Button variant='ghost' size='xxs' tooltip={t('delete')} onClick={() => onDelete(data.id)}>
                  <Trash2Icon />
                </Button>
              )}
            </div>
            <p className='text-gray-500 text-[12px]'>{new Date(data.savedAt).toLocaleString()}</p>
          </div>
        )}
      </div>
    </li>
  );
}
