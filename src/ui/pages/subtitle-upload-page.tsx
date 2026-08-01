
import { useCallback, useEffect, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { t } from '@utils/i18n';
import { ArrowLeftIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { SubtitleRole, SubtitleRoleSelection, useSubtitleSettings } from '@/ui/features/subtitle/use-subtitle-settings';
import { SubtitleAdder, SubtitleAddSource } from '@/ui/features/subtitle-upload/subtitle-adder';
import { SubtitleCard } from '@/ui/features/subtitle-upload/subtitle-card';
import { SubtitleRoleSummary } from '@/ui/features/subtitle-upload/subtitle-role-summary';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { useConfigStore } from '@/ui/store/config-store';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

export function SubtitleUploadPage() {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const primaryConfig = useConfigStore((state) => state.configs.primarySubtitle);
  const secondaryConfig = useConfigStore((state) => state.configs.secondarySubtitle);
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
  const setPage = usePageStore((state) => state.setPage);
  const { subtitles, editSubtitle, updateDelay, deleteSubtitle, loading } = useUploadedSubtitles(activeTab);
  const { useAsSubtitle, pendingRoles, isAvailable } = useSubtitleSettings(activeTab, tabInfo);

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

  const handleRoleChange = useCallback(
    (role: SubtitleRole, subtitleId: SubtitleId | null, delay: number) => {
      const previousSubtitleId = role === 'primary' ? tabInfo?.primarySubtitle ?? null : tabInfo?.secondarySubtitle ?? null;
      const previousDelay = subtitles.find((subtitle) => subtitle.id === previousSubtitleId)?.delay ?? 0;
      const selection: SubtitleRoleSelection = {
        role,
        subtitleId,
        delay,
        previousSubtitleId,
        previousDelay,
      };
      void useAsSubtitle(selection);
    },
    [subtitles, tabInfo?.primarySubtitle, tabInfo?.secondarySubtitle, useAsSubtitle]
  );

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
      <SubtitleRoleSummary
        subtitles={subtitles}
        tabInfo={tabInfo}
        primaryConfig={primaryConfig}
        secondaryConfig={secondaryConfig}
        isAvailable={isAvailable}
        pendingRoles={pendingRoles}
        onReturnToDefault={(role, previousSubtitleId, previousDelay) =>
          useAsSubtitle({ role, subtitleId: null, delay: 0, previousSubtitleId, previousDelay })
        }
      />
      <div className='shrink-0 pt-2'>
        <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='title' />
      </div>
      <div className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 py-2'>
        <ul className='flex flex-col gap-2.5'>
          {filteredSubtitles.map((item) => (
            <SubtitleCard
              key={item.id}
              itemRef={(node) => {
                if (node) subtitleItemRefs.current.set(item.id, node);
                else subtitleItemRefs.current.delete(item.id);
              }}
              data={item}
              tabInfo={tabInfo}
              isAvailable={isAvailable}
              pendingRoles={pendingRoles}
              onDelete={deleteSubtitle}
              onEdit={editSubtitle}
              onUpdateDelay={updateDelay}
              onAnalyze={(id) => setPage('subtitle-analysis', { id })}
              onRoleChange={(role, subtitleId, delay) => handleRoleChange(role, subtitleId, delay)}
            />
          ))}
        </ul>
      </div>
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
