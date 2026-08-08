import { useEffect, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { Language, LANGUAGES } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { CaptionsIcon, EyeIcon, PencilIcon, Settings2Icon, Trash2Icon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import {
  PendingSubtitleRoles,
  SubtitleRole,
} from '@/ui/features/subtitle/use-subtitle-settings';
import { SubtitleDelayForm } from '@/ui/features/subtitle-upload/subtitle-delay-form';
import { SubtitleEditForm } from '@/ui/features/subtitle-upload/subtitle-edit-form';

interface SubtitleCardProps {
  data: V2RegisteredSubtitleMetadata;
  itemRef: (node: HTMLLIElement | null) => void;
  tabInfo: TabInfo | null;
  isAvailable: boolean;
  isRoleAvailable: (role: SubtitleRole, language: Language) => boolean;
  pendingRoles: PendingSubtitleRoles;
  previewButtonRef?: React.Ref<HTMLButtonElement>;
  previewDisabled?: boolean;
  onDelete: (id: SubtitleId) => void;
  onEdit: (id: SubtitleId, title: string, language: Language) => Promise<void>;
  onPreview: (id: SubtitleId) => void;
  onUpdateDelay: (id: SubtitleId, delay: number) => Promise<void>;
  onRoleChange: (role: SubtitleRole, subtitleId: SubtitleId | null) => void;
}

export function SubtitleCard({
  data,
  itemRef,
  tabInfo,
  isAvailable,
  isRoleAvailable,
  pendingRoles,
  previewButtonRef,
  previewDisabled = false,
  onDelete,
  onEdit,
  onPreview,
  onUpdateDelay,
  onRoleChange,
}: SubtitleCardProps) {
  const [mode, setMode] = useState<SubtitleCardMode>('default');
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const modeHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef<Exclude<SubtitleCardMode, 'default'> | null>(null);
  const syncButtonRef = useRef<HTMLButtonElement>(null);
  const isLearning = tabInfo?.learningSubtitleId === data.id;
  const isSupport = tabInfo?.supportSubtitleId === data.id;
  const isCardPending = pendingRoles.learning || pendingRoles.support;
  const titleId = `subtitle-title-${data.id}`;
  const syncHeadingId = `subtitle-sync-heading-${data.id}`;

  useEffect(() => {
    if (mode === 'default') {
      const origin = restoreFocusRef.current;
      if (origin === null) return;
      const target = origin === 'edit' ? editButtonRef.current : syncButtonRef.current;
      target?.focus();
      restoreFocusRef.current = null;
      return;
    }
    modeHeadingRef.current?.focus();
  }, [mode]);

  const changeRole = (role: SubtitleRole, selected: boolean) => {
    onRoleChange(role, selected ? null : data.id);
  };

  const openMode = (nextMode: Exclude<SubtitleCardMode, 'default'>) => {
    restoreFocusRef.current = nextMode;
    setMode(nextMode);
  };

  return (
    <li
      ref={itemRef}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-busy={isCardPending || undefined}
      className={cn(
        'min-w-0 shrink-0 rounded-xl border bg-background outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50',
        (isLearning || isSupport) && 'border-primary/40 bg-primary/5'
      )}
    >
      <div className='flex min-w-0 flex-col gap-2.5 p-3'>
        {mode === 'edit' && (
          <section className='flex min-w-0 flex-col gap-2' aria-labelledby={titleId}>
            <div className='flex items-center gap-2'>
              <PencilIcon className='size-4 shrink-0' />
              <h3 ref={modeHeadingRef} id={titleId} tabIndex={-1} className='text-[14px] font-semibold outline-none'>
                {t('v2_local_subtitles_edit_details')}
              </h3>
            </div>
            <SubtitleEditForm
              id={data.id}
              initialTitle={data.title}
              initialLanguage={data.language}
              onEdit={onEdit}
              closeEditMode={() => setMode('default')}
            />
          </section>
        )}

        {mode === 'sync' && (
          <>
            <SubtitleIdentityHeader
              data={data}
              titleId={titleId}
              isLearning={isLearning}
              isSupport={isSupport}
              showRoleBadges={false}
              showAddedDate={false}
            />
            <section className='flex min-w-0 flex-col gap-2 border-t pt-2' aria-labelledby={syncHeadingId}>
              <div className='flex items-center gap-2'>
                <Settings2Icon className='size-4 shrink-0' />
                <h3
                  ref={modeHeadingRef}
                  id={syncHeadingId}
                  tabIndex={-1}
                  className='text-[14px] font-semibold outline-none'
                >
                  {t('v2_local_subtitles_sync_adjustment')}
                </h3>
              </div>
              <SubtitleDelayForm
                initialDelay={data.delay}
                onUpdateDelay={async (delay) => {
                  await onUpdateDelay(data.id, delay);
                  setMode('default');
                }}
                closeEditMode={() => setMode('default')}
              />
            </section>
          </>
        )}

        {mode === 'default' && (
          <>
            <SubtitleIdentityHeader
              data={data}
              titleId={titleId}
              isLearning={isLearning}
              isSupport={isSupport}
              showRoleBadges
              showAddedDate
            />

            <Button
              ref={previewButtonRef}
              variant='outline'
              size='sm'
              className='min-h-9 w-full'
              data-subtitle-preview-id={data.id}
              disabled={isCardPending || previewDisabled}
              onClick={() => onPreview(data.id)}
            >
              <EyeIcon />
              {t('v2_local_subtitles_preview')}
            </Button>

            <fieldset className='min-w-0'>
              <legend className='sr-only'>
                {t('v2_local_subtitles_current_tab_use')}
              </legend>
              <div className='grid gap-2 min-[360px]:grid-cols-2'>
                <RoleButton
                  role='learning'
                  selected={isLearning}
                  available={isLearning ? isAvailable : isRoleAvailable('learning', data.language)}
                  pending={pendingRoles.learning}
                  onClick={() => changeRole('learning', isLearning)}
                />
                <RoleButton
                  role='support'
                  selected={isSupport}
                  available={isSupport ? isAvailable : isRoleAvailable('support', data.language)}
                  pending={pendingRoles.support}
                  onClick={() => changeRole('support', isSupport)}
                />
              </div>
            </fieldset>

            <div className='flex items-center gap-1'>
              <Button
                ref={syncButtonRef}
                variant='ghost'
                size='sm'
                className='min-h-9 min-w-0 px-2 text-xs'
                disabled={isCardPending}
                onClick={() => openMode('sync')}
              >
                <Settings2Icon />
                {t('v2_local_subtitles_sync')}
              </Button>
              <Button
                ref={editButtonRef}
                variant='ghost'
                size='sm'
                aria-label={t('v2_local_subtitles_edit_details')}
                className='min-h-9 min-w-0 px-2 text-xs'
                disabled={isCardPending}
                onClick={() => openMode('edit')}
              >
                <PencilIcon />
                {t('v2_local_subtitles_edit')}
              </Button>
              <Button
                variant='ghost'
                size='sm'
                className='ml-auto min-h-9 min-w-0 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive'
                disabled={isCardPending}
                onClick={() => onDelete(data.id)}
              >
                <Trash2Icon />
                {t('delete')}
              </Button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

type SubtitleCardMode = 'default' | 'edit' | 'sync';

interface SubtitleIdentityHeaderProps {
  data: V2RegisteredSubtitleMetadata;
  titleId: string;
  isLearning: boolean;
  isSupport: boolean;
  showRoleBadges: boolean;
  showAddedDate: boolean;
}

function SubtitleIdentityHeader({
  data,
  titleId,
  isLearning,
  isSupport,
  showRoleBadges,
  showAddedDate,
}: SubtitleIdentityHeaderProps) {
  return (
    <header className='min-w-0'>
      <h3
        id={titleId}
        className='line-clamp-2 min-w-0 text-wrap text-[15px] font-semibold leading-5 [overflow-wrap:anywhere]'
      >
        {data.title}
      </h3>
      <div className='mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-gray-500'>
        <span className='whitespace-nowrap'>{t(LANGUAGES[data.language])}</span>
        {showRoleBadges && isLearning && <RoleBadge>{t('learning_subtitle')}</RoleBadge>}
        {showRoleBadges && isSupport && <RoleBadge>{t('support_subtitle')}</RoleBadge>}
        <span className='whitespace-nowrap'>
          <span aria-hidden='true'>· </span>
          {t('v2_local_subtitles_sync_value', formatDelay(data.delay))}
        </span>
        {showAddedDate && (
          <span className='whitespace-nowrap'>
            <span aria-hidden='true'>· </span>
            {t('v2_local_subtitles_added_date', formatSavedAt(data.savedAt))}
          </span>
        )}
      </div>
    </header>
  );
}

function RoleBadge({ children }: { children: React.ReactNode }) {
  return <span className='rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary'>{children}</span>;
}

interface RoleButtonProps {
  role: SubtitleRole;
  selected: boolean;
  available: boolean;
  pending: boolean;
  onClick: () => void;
}

function RoleButton({ role, selected, available, pending, onClick }: RoleButtonProps) {
  const roleTitle = t(role === 'learning' ? 'learning_subtitle' : 'support_subtitle');
  const accessibleName = pending
    ? `${roleTitle}: ${t('v2_local_subtitles_applying')}`
    : selected
      ? `${roleTitle}: ${t('v2_local_subtitles_default_short')}`
      : roleTitle;

  return (
    <Button
      type='button'
      variant={selected ? 'secondary' : 'outline'}
      className='min-h-11 h-auto min-w-0 whitespace-normal px-2 py-2 text-left'
      aria-pressed={selected}
      aria-label={accessibleName}
      disabled={pending || !available}
      onClick={onClick}
    >
      <CaptionsIcon className='size-5' />
      <span className='min-w-0 leading-4'>
        <span className='block'>{pending ? t('v2_local_subtitles_applying') : roleTitle}</span>
        {selected && !pending && (
          <span className='block text-[10px] font-normal text-gray-600'>
            {t('v2_local_subtitles_default_short')}
          </span>
        )}
      </span>
    </Button>
  );
}

function formatDelay(delay?: number) {
  return (delay ?? 0).toFixed(1).replace(/\.0$/, '');
}

function formatSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(savedAt));
}
