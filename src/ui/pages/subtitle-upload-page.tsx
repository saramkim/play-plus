
import { useCallback, useEffect, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { SubtitleMetadata } from '@storage/type';
import { Language, LANGUAGES, SET_SUBTITLE_ACTION } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { ArrowLeftIcon, BookOpenTextIcon, CaptionsIcon, CaptionsOffIcon, Settings2Icon, Trash2Icon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { useSubtitleSettings } from '@/ui/features/subtitle/use-subtitle-settings';
import { SubtitleAdder, SubtitleAddSource } from '@/ui/features/subtitle-upload/subtitle-adder';
import { SubtitleDelayForm } from '@/ui/features/subtitle-upload/subtitle-delay-form';
import { SubtitleEditForm } from '@/ui/features/subtitle-upload/subtitle-edit-form';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

export function SubtitleUploadPage() {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const [filteredSubtitles, setFilteredSubtitles] = useState<SubtitleMetadata[]>([]);
  const [mode, setMode] = useState<SubtitleUploadMode>({ name: 'list' });
  const [isAddBusy, setIsAddBusy] = useState(false);
  const [pendingFocusId, setPendingFocusId] = useState<SubtitleId | null>(null);
  const addHeadingRef = useRef<HTMLHeadingElement>(null);
  const emptyFileButtonRef = useRef<HTMLButtonElement>(null);
  const emptyOnlineButtonRef = useRef<HTMLButtonElement>(null);
  const listAddButtonRef = useRef<HTMLButtonElement>(null);
  const listModeRef = useRef<HTMLDivElement>(null);
  const subtitleItemRefs = useRef(new Map<SubtitleId, HTMLLIElement>());
  const restoreFocusOriginRef = useRef<AddModeOrigin | null>(null);
  const setNavigationLocked = usePageStore((state) => state.setNavigationLocked);
  const { subtitles, editSubtitle, updateDelay, deleteSubtitle, loading } = useUploadedSubtitles(activeTab);

  useEffect(() => {
    return () => setNavigationLocked(false);
  }, [setNavigationLocked]);

  useEffect(() => {
    if (mode.name === 'add' && !mode.focusFirstControl) addHeadingRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (mode.name !== 'list' || restoreFocusOriginRef.current === null) return;

    const origin = restoreFocusOriginRef.current;
    const originTarget =
      origin === 'list'
        ? listAddButtonRef.current
        : origin === 'empty-file'
          ? emptyFileButtonRef.current
          : emptyOnlineButtonRef.current;

    (originTarget ?? listAddButtonRef.current ?? emptyFileButtonRef.current ?? listModeRef.current)?.focus();
    restoreFocusOriginRef.current = null;
  }, [mode.name, subtitles.length]);

  useEffect(() => {
    if (mode.name !== 'list' || pendingFocusId === null) return;

    const target = subtitleItemRefs.current.get(pendingFocusId);
    if (!target) return;

    target.scrollIntoView({ block: 'nearest' });
    target.focus();
    setPendingFocusId(null);
  }, [filteredSubtitles, mode.name, pendingFocusId]);

  useEffect(() => {
    if (mode.name !== 'list' || pendingFocusId === null) return;

    const fallbackTimer = window.setTimeout(() => {
      (listAddButtonRef.current ?? emptyFileButtonRef.current ?? listModeRef.current)?.focus();
      setPendingFocusId(null);
    }, 1500);

    return () => window.clearTimeout(fallbackTimer);
  }, [mode.name, pendingFocusId]);

  const openAddMode = (initialSource: SubtitleAddSource, origin: AddModeOrigin, focusFirstControl: boolean) => {
    restoreFocusOriginRef.current = origin;
    setIsAddBusy(false);
    setNavigationLocked(false);
    setMode({ name: 'add', initialSource, focusFirstControl });
  };

  const closeAddMode = () => {
    setIsAddBusy(false);
    setNavigationLocked(false);
    setMode({ name: 'list' });
  };

  const handleAdded = useCallback((subtitle: SubtitleMetadata) => {
    restoreFocusOriginRef.current = null;
    setIsAddBusy(false);
    setNavigationLocked(false);
    setPendingFocusId(subtitle.id);
    setMode({ name: 'list' });
  }, [setNavigationLocked]);

  const handleAddBusyChange = useCallback((busy: boolean) => {
    setIsAddBusy(busy);
    setNavigationLocked(busy);
  }, [setNavigationLocked]);

  if (loading) return null;

  if (mode.name === 'add') {
    return (
      <div className='flex h-full min-h-0 flex-col'>
        <header className='flex shrink-0 items-center gap-2 border-b p-4'>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('back_to_subtitles')}
            disabled={isAddBusy}
            onClick={closeAddMode}
          >
            <ArrowLeftIcon />
          </Button>
          <h2 ref={addHeadingRef} tabIndex={-1} className='text-[15px] font-semibold outline-none'>
            {t('subtitle_upload')}
          </h2>
        </header>
        <div className='min-h-0 flex-1 overflow-y-auto p-4'>
          <SubtitleAdder
            initialSource={mode.initialSource}
            focusFirstControl={mode.focusFirstControl}
            onAdded={handleAdded}
            onBusyChange={handleAddBusyChange}
          />
        </div>
      </div>
    );
  }

  if (subtitles.length === 0) {
    return (
      <EmptyState
        containerRef={listModeRef}
        fileButtonRef={emptyFileButtonRef}
        onlineButtonRef={emptyOnlineButtonRef}
        onAddFromFile={() => openAddMode('file', 'empty-file', true)}
        onFindOnline={() => openAddMode('online', 'empty-online', true)}
      />
    );
  }

  return (
    <div ref={listModeRef} tabIndex={-1} className='flex h-full min-h-0 flex-col p-4 outline-none'>
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='title' />
      <ul className='flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto px-1 py-2'>
        {filteredSubtitles.map((item) => (
          <SubtitleItem
            key={item.id}
            itemRef={(node) => {
              if (node) subtitleItemRefs.current.set(item.id, node);
              else subtitleItemRefs.current.delete(item.id);
            }}
            data={item}
            activeTab={activeTab}
            tabInfo={tabInfo}
            onDelete={deleteSubtitle}
            onEdit={editSubtitle}
            onUpdateDelay={updateDelay}
          />
        ))}
      </ul>
      <footer className='shrink-0 border-t pt-3'>
        <Button
          ref={listAddButtonRef}
          className='w-full'
          onClick={() => openAddMode('file', 'list', false)}
        >
          {t('subtitle_upload')}
        </Button>
      </footer>
    </div>
  );
}

type SubtitleUploadMode =
  | { name: 'list' }
  | { name: 'add'; initialSource: SubtitleAddSource; focusFirstControl: boolean };

type AddModeOrigin = 'list' | 'empty-file' | 'empty-online';

interface EmptyStateProps {
  containerRef: React.Ref<HTMLDivElement>;
  fileButtonRef: React.Ref<HTMLButtonElement>;
  onlineButtonRef: React.Ref<HTMLButtonElement>;
  onAddFromFile: () => void;
  onFindOnline: () => void;
}

function EmptyState({
  containerRef,
  fileButtonRef,
  onlineButtonRef,
  onAddFromFile,
  onFindOnline,
}: EmptyStateProps) {
  return (
    <div ref={containerRef} tabIndex={-1} className='flex h-full min-h-0 flex-col justify-center p-4 outline-none'>
      <div className='flex flex-col gap-3'>
        <p className='text-wrap text-center text-gray-500'>{t('subtitle_registration_description')}</p>
        <Button ref={fileButtonRef} onClick={onAddFromFile}>
          {t('add_from_file')}
        </Button>
        <Button ref={onlineButtonRef} variant='outline' onClick={onFindOnline}>
          {t('find_online')}
        </Button>
      </div>
    </div>
  );
}

interface SubtitleItemProps {
  data: SubtitleMetadata;
  itemRef: (node: HTMLLIElement | null) => void;
  activeTab: chrome.tabs.Tab | null;
  tabInfo: TabInfo | null;
  onDelete: (id: SubtitleId) => void;
  onEdit: (id: SubtitleId, title: string, language: Language) => Promise<void>;
  onUpdateDelay: (id: SubtitleId, delay: number) => Promise<void>;
}

function SubtitleItem({ data, itemRef, activeTab, tabInfo, onDelete, onEdit, onUpdateDelay }: SubtitleItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDelayEditing, setIsDelayEditing] = useState(false);
  const { useAsSubtitle, isAvailable } = useSubtitleSettings(activeTab);
  const setPage = usePageStore((state) => state.setPage);

  const isPrimarySubtitle = tabInfo?.primarySubtitle === data.id;
  const isSecondarySubtitle = tabInfo?.secondarySubtitle === data.id;

  return (
    <li
      ref={itemRef}
      tabIndex={-1}
      className={cn(
        'min-w-0 max-w-full shrink-0 rounded-lg border shadow-sm outline-none transition-colors duration-150 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[1px]',
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
