import { useEffect, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { SubtitleMetadata } from '@storage/type';
import { Language, LANGUAGES } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { BookOpenTextIcon, CaptionsIcon, PencilIcon, Settings2Icon, Trash2Icon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import {
  PendingSubtitleRoles,
  SubtitleRole,
} from '@/ui/features/subtitle/use-subtitle-settings';
import { SubtitleDelayForm } from '@/ui/features/subtitle-upload/subtitle-delay-form';
import { SubtitleEditForm } from '@/ui/features/subtitle-upload/subtitle-edit-form';

interface SubtitleCardProps {
  data: SubtitleMetadata;
  itemRef: (node: HTMLLIElement | null) => void;
  tabInfo: TabInfo | null;
  isAvailable: boolean;
  pendingRoles: PendingSubtitleRoles;
  onDelete: (id: SubtitleId) => void;
  onEdit: (id: SubtitleId, title: string, language: Language) => Promise<void>;
  onUpdateDelay: (id: SubtitleId, delay: number) => Promise<void>;
  onAnalyze: (id: SubtitleId) => void;
  onRoleChange: (role: SubtitleRole, subtitleId: SubtitleId | null, delay: number) => void;
}

export function SubtitleCard({
  data,
  itemRef,
  tabInfo,
  isAvailable,
  pendingRoles,
  onDelete,
  onEdit,
  onUpdateDelay,
  onAnalyze,
  onRoleChange,
}: SubtitleCardProps) {
  const [mode, setMode] = useState<SubtitleCardMode>('default');
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const modeHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreFocusRef = useRef<Exclude<SubtitleCardMode, 'default'> | null>(null);
  const syncButtonRef = useRef<HTMLButtonElement>(null);
  const isPrimary = tabInfo?.primarySubtitle === data.id;
  const isSecondary = tabInfo?.secondarySubtitle === data.id;
  const isCardPending = pendingRoles.primary || pendingRoles.secondary;
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
    onRoleChange(role, selected ? null : data.id, selected ? 0 : data.delay ?? 0);
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
        'min-w-0 shrink-0 rounded-xl border bg-background shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50',
        (isPrimary || isSecondary) && 'border-primary/40 bg-primary/5'
      )}
    >
      <div className='flex min-w-0 flex-col gap-2.5 p-3'>
        {mode === 'edit' && (
          <section className='flex min-w-0 flex-col gap-2' aria-labelledby={titleId}>
            <div className='flex items-center gap-2'>
              <PencilIcon className='size-4 shrink-0' />
              <h3 ref={modeHeadingRef} id={titleId} tabIndex={-1} className='text-[14px] font-semibold outline-none'>
                {t('edit_subtitle_details')}
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
              isPrimary={isPrimary}
              isSecondary={isSecondary}
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
                  {t('sync_adjustment')}
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
              isPrimary={isPrimary}
              isSecondary={isSecondary}
              showRoleBadges
              showAddedDate
            />

            <fieldset className='min-w-0' disabled={!isAvailable}>
              <legend className='mb-1.5 text-[12px] font-medium text-gray-600'>{t('current_tab_use')}</legend>
              <div className='grid gap-2 min-[360px]:grid-cols-2'>
                <RoleButton
                  role='primary'
                  selected={isPrimary}
                  pending={pendingRoles.primary}
                  onClick={() => changeRole('primary', isPrimary)}
                />
                <RoleButton
                  role='secondary'
                  selected={isSecondary}
                  pending={pendingRoles.secondary}
                  onClick={() => changeRole('secondary', isSecondary)}
                />
              </div>
            </fieldset>

            <div className='grid grid-cols-2 gap-2'>
              <Button variant='outline' size='sm' className='min-h-9' onClick={() => onAnalyze(data.id)}>
                <BookOpenTextIcon />
                {t('analyze')}
              </Button>
              <Button
                ref={syncButtonRef}
                variant='outline'
                size='sm'
                className='min-h-9'
                disabled={isCardPending}
                onClick={() => openMode('sync')}
              >
                <Settings2Icon />
                {t('sync')}
              </Button>
              <Button
                ref={editButtonRef}
                variant='outline'
                size='sm'
                aria-label={t('edit_subtitle_details')}
                className={cn('min-h-9', (isPrimary || isSecondary) && 'col-span-2')}
                disabled={isCardPending}
                onClick={() => openMode('edit')}
              >
                <PencilIcon />
                {t('edit_short')}
              </Button>
              {!isPrimary && !isSecondary && (
                <Button
                  variant='outline'
                  size='sm'
                  className='min-h-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive'
                  disabled={isCardPending}
                  onClick={() => onDelete(data.id)}
                >
                  <Trash2Icon />
                  {t('delete')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

type SubtitleCardMode = 'default' | 'edit' | 'sync';

interface SubtitleIdentityHeaderProps {
  data: SubtitleMetadata;
  titleId: string;
  isPrimary: boolean;
  isSecondary: boolean;
  showRoleBadges: boolean;
  showAddedDate: boolean;
}

function SubtitleIdentityHeader({
  data,
  titleId,
  isPrimary,
  isSecondary,
  showRoleBadges,
  showAddedDate,
}: SubtitleIdentityHeaderProps) {
  return (
    <header className='min-w-0'>
      <div className='flex flex-wrap items-center gap-1.5'>
        <span className='rounded-full bg-gray-100 px-2 py-0.5 text-[12px] text-gray-600'>
          {t(LANGUAGES[data.language])}
        </span>
        {showRoleBadges && isPrimary && <RoleBadge>{t('primary_subtitle')}</RoleBadge>}
        {showRoleBadges && isSecondary && <RoleBadge>{t('secondary_subtitle')}</RoleBadge>}
      </div>
      <h3
        id={titleId}
        className='mt-1.5 line-clamp-2 min-w-0 text-wrap text-[15px] font-semibold [overflow-wrap:anywhere]'
      >
        {data.title}
      </h3>
      <p className='mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-500'>
        <span>{t('sync_value', formatDelay(data.delay))}</span>
        {showAddedDate && <span>{t('added_date', formatSavedAt(data.savedAt))}</span>}
      </p>
    </header>
  );
}

function RoleBadge({ children }: { children: React.ReactNode }) {
  return <span className='rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary'>{children}</span>;
}

interface RoleButtonProps {
  role: SubtitleRole;
  selected: boolean;
  pending: boolean;
  onClick: () => void;
}

function RoleButton({ role, selected, pending, onClick }: RoleButtonProps) {
  const selectedText = role === 'primary' ? t('primary_selected') : t('secondary_selected');
  const defaultText = role === 'primary' ? t('use_as_primary') : t('use_as_secondary');
  const activeLabel = role === 'primary' ? t('return_primary_to_default') : t('return_secondary_to_default');

  return (
    <Button
      type='button'
      variant={selected ? 'secondary' : 'outline'}
      className='min-h-11 h-auto min-w-0 whitespace-normal px-2 py-2 text-left'
      aria-pressed={selected}
      aria-label={selected ? activeLabel : defaultText}
      disabled={pending}
      onClick={onClick}
    >
      <CaptionsIcon className='size-5' />
      <span className='min-w-0 leading-4'>
        <span className='block'>{pending ? t('applying') : selected ? selectedText : defaultText}</span>
        {selected && !pending && <span className='block text-[10px] font-normal text-gray-600'>{t('press_to_use_default')}</span>}
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
