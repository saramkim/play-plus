import { useCallback, useEffect, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import {
  V2RegisteredSubtitleMetadata,
  V2SyncStorage,
  V2UnavailableRegisteredSubtitle,
} from '@storage/v2/type';
import { t } from '@utils/i18n';
import { ArrowLeftIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import { clearSubtitleRolesWithRollback } from '@/ui/features/subtitle/subtitle-role-transaction';
import {
  isSubtitleRoleLanguage,
  SubtitleRole,
  useSubtitleSettings,
} from '@/ui/features/subtitle/use-subtitle-settings';
import { SubtitleAdder, SubtitleAddSource } from '@/ui/features/subtitle-upload/subtitle-adder';
import { SubtitleCard } from '@/ui/features/subtitle-upload/subtitle-card';
import { SubtitleRoleSummary } from '@/ui/features/subtitle-upload/subtitle-role-summary';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

interface SubtitleUploadPageProps {
  learningProfile: V2SyncStorage['learningProfile'];
}

export function SubtitleUploadPage({ learningProfile }: SubtitleUploadPageProps) {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const [filteredSubtitles, setFilteredSubtitles] = useState<V2RegisteredSubtitleMetadata[]>([]);
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
  const { useAsSubtitle, pendingRoles, isAvailable, isRoleAvailable } = useSubtitleSettings(
    activeTab,
    tabInfo,
    learningProfile
  );

  const prepareRoleMutation = useCallback(
    async (id: SubtitleId, shouldClear: (role: SubtitleRole) => boolean) => {
      const selectedRoles: Array<{ role: SubtitleRole; subtitleId: string | null }> = [
        { role: 'learning', subtitleId: tabInfo?.learningSubtitleId ?? null },
        { role: 'support', subtitleId: tabInfo?.supportSubtitleId ?? null },
      ];

      return clearSubtitleRolesWithRollback(
        selectedRoles.flatMap(({ role, subtitleId }) =>
          subtitleId === id && shouldClear(role) ? [{ role, subtitleId: id }] : []
        ),
        useAsSubtitle
      );
    },
    [tabInfo?.learningSubtitleId, tabInfo?.supportSubtitleId, useAsSubtitle]
  );
  const prepareSubtitleDeletion = useCallback(
    (id: SubtitleId) => prepareRoleMutation(id, () => true),
    [prepareRoleMutation]
  );
  const prepareSubtitleLanguageChange = useCallback(
    (id: SubtitleId, language: V2RegisteredSubtitleMetadata['language']) =>
      prepareRoleMutation(
        id,
        (role) => !isSubtitleRoleLanguage(role, language, learningProfile)
      ),
    [learningProfile, prepareRoleMutation]
  );

  const {
    subtitles,
    unavailableSubtitles,
    editSubtitle,
    updateDelay,
    deleteSubtitle,
    loading,
    loadError,
    reload,
  } = useUploadedSubtitles(
    activeTab,
    prepareSubtitleDeletion,
    prepareSubtitleLanguageChange
  );

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
    (
      originTarget ??
      listAddButtonRef.current ??
      emptyFileButtonRef.current ??
      emptyOnlineButtonRef.current ??
      listModeRef.current
    )?.focus();
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
      (
        listAddButtonRef.current ??
        emptyFileButtonRef.current ??
        emptyOnlineButtonRef.current ??
        listModeRef.current
      )?.focus();
      setPendingFocusId(null);
    }, 1500);
    return () => window.clearTimeout(fallbackTimer);
  }, [mode.name, pendingFocusId]);

  const openAddMode = (
    initialSource: SubtitleAddSource,
    origin: AddModeOrigin,
    focusFirstControl: boolean
  ) => {
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

  const handleAdded = useCallback(
    (subtitle: V2RegisteredSubtitleMetadata) => {
      restoreFocusOriginRef.current = null;
      setIsAddBusy(false);
      setNavigationLocked(false);
      setPendingFocusId(subtitle.id);
      setMode({ name: 'list' });
    },
    [setNavigationLocked]
  );

  const handleAddBusyChange = useCallback(
    (busy: boolean) => {
      setIsAddBusy(busy);
      setNavigationLocked(busy);
    },
    [setNavigationLocked]
  );

  const handleRoleChange = (role: SubtitleRole, subtitleId: SubtitleId | null) => {
    const previousSubtitleId =
      role === 'learning'
        ? tabInfo?.learningSubtitleId ?? null
        : tabInfo?.supportSubtitleId ?? null;
    void useAsSubtitle({ role, subtitleId, previousSubtitleId });
  };

  if (loading) return <PageStatus message={t('v2_local_subtitles_loading')} />;
  if (loadError) return <LoadError onRetry={reload} />;

  if (mode.name === 'add') {
    return (
      <div className='flex h-full min-h-0 flex-col overflow-hidden'>
        <header className='flex shrink-0 items-center gap-2 border-b p-4'>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('v2_local_subtitles_back')}
            disabled={isAddBusy}
            onClick={closeAddMode}
          >
            <ArrowLeftIcon />
          </Button>
          <h2 ref={addHeadingRef} tabIndex={-1} className='text-[15px] font-semibold outline-none'>
            {t('v2_local_subtitles_add')}
          </h2>
        </header>
        <div
          className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4'
          data-scroll-owner='local-subtitles'
        >
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
        unavailableSubtitles={unavailableSubtitles}
        onAddFromFile={() => openAddMode('file', 'empty-file', true)}
        onFindOnline={() => openAddMode('online', 'empty-online', true)}
      />
    );
  }

  return (
    <div ref={listModeRef} tabIndex={-1} className='flex h-full min-h-0 flex-col overflow-hidden p-4 outline-none'>
      <SubtitleRoleSummary
        subtitles={subtitles}
        tabInfo={tabInfo}
        learningProfile={learningProfile}
        isAvailable={isAvailable}
        pendingRoles={pendingRoles}
        onReturnToDefault={(role, previousSubtitleId) =>
          useAsSubtitle({ role, subtitleId: null, previousSubtitleId })
        }
      />
      <div className='shrink-0 pt-2'>
        <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='title' />
      </div>
      <div
        className='min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 py-2'
        data-scroll-owner='local-subtitles'
      >
        <UnavailableSubtitleNotice subtitles={unavailableSubtitles} />
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
              isRoleAvailable={isRoleAvailable}
              pendingRoles={pendingRoles}
              onDelete={deleteSubtitle}
              onEdit={editSubtitle}
              onUpdateDelay={updateDelay}
              onRoleChange={handleRoleChange}
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
          {t('v2_local_subtitles_add')}
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
  unavailableSubtitles: V2UnavailableRegisteredSubtitle[];
  onAddFromFile: () => void;
  onFindOnline: () => void;
}

function EmptyState({
  containerRef,
  fileButtonRef,
  onlineButtonRef,
  unavailableSubtitles,
  onAddFromFile,
  onFindOnline,
}: EmptyStateProps) {
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      className='flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto p-4 outline-none'
      data-scroll-owner='local-subtitles'
    >
      <UnavailableSubtitleNotice subtitles={unavailableSubtitles} />
      <div className='flex min-h-40 flex-1 flex-col justify-center gap-3'>
        <p className='text-wrap text-center text-gray-500'>{t('v2_local_subtitles_empty_description')}</p>
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

function PageStatus({ message }: { message: string }) {
  return (
    <div
      className='flex h-full min-h-0 items-center justify-center overflow-y-auto p-4 text-center text-sm text-muted-foreground'
      data-scroll-owner='local-subtitles'
      role='status'
    >
      {message}
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <div
      className='flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center'
      data-scroll-owner='local-subtitles'
    >
      <p role='alert' className='text-wrap text-sm text-destructive'>
        {t('v2_local_subtitles_load_error')}
      </p>
      <Button type='button' variant='outline' onClick={() => void onRetry()}>
        {t('v2_retry')}
      </Button>
    </div>
  );
}

const UNAVAILABLE_REASON_LABELS: Record<V2UnavailableRegisteredSubtitle['reason'], string> = {
  'invalid-metadata': t('v2_local_subtitles_unavailable_invalid_metadata'),
  'missing-body': t('v2_local_subtitles_unavailable_missing_body'),
  'invalid-body': t('v2_local_subtitles_unavailable_invalid_body'),
  'orphan-body': t('v2_local_subtitles_unavailable_orphan_body'),
};

function UnavailableSubtitleNotice({
  subtitles,
}: {
  subtitles: V2UnavailableRegisteredSubtitle[];
}) {
  if (subtitles.length === 0) return null;
  const counts = subtitles.reduce<Partial<Record<V2UnavailableRegisteredSubtitle['reason'], number>>>(
    (result, subtitle) => ({
      ...result,
      [subtitle.reason]: (result[subtitle.reason] ?? 0) + 1,
    }),
    {}
  );

  return (
    <section
      className='mb-3 min-w-0 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-wrap'
      aria-labelledby='unavailable-migrated-subtitles-title'
      data-testid='unavailable-migrated-subtitles'
    >
      <h2 id='unavailable-migrated-subtitles-title' className='text-sm font-semibold'>
        {t('v2_local_subtitles_unavailable_title', String(subtitles.length))}
      </h2>
      <p className='mt-1 text-xs text-muted-foreground'>
        {t('v2_local_subtitles_unavailable_description')}
      </p>
      <ul className='mt-2 list-disc pl-5 text-xs'>
        {Object.entries(counts).map(([reason, count]) => (
          <li key={reason}>
            {UNAVAILABLE_REASON_LABELS[reason as V2UnavailableRegisteredSubtitle['reason']]}: {count}
          </li>
        ))}
      </ul>
    </section>
  );
}
