import { useRef } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { V2RegisteredSubtitleMetadata, V2SyncStorage } from '@storage/v2/type';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';
import { TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { PendingSubtitleRoles, SubtitleRole } from '@/ui/features/subtitle/use-subtitle-settings';

interface SubtitleRoleSummaryProps {
  subtitles: V2RegisteredSubtitleMetadata[];
  tabInfo: TabInfo | null;
  learningProfile: V2SyncStorage['learningProfile'];
  isAvailable: boolean;
  pendingRoles: PendingSubtitleRoles;
  onReturnToDefault: (
    role: SubtitleRole,
    previousSubtitleId: SubtitleId | null
  ) => Promise<boolean>;
}

export function SubtitleRoleSummary({
  subtitles,
  tabInfo,
  learningProfile,
  isAvailable,
  pendingRoles,
  onReturnToDefault,
}: SubtitleRoleSummaryProps) {
  return (
    <section
      aria-labelledby='current-tab-subtitles-heading'
      className='shrink-0 min-w-0 bg-muted/40 px-2'
    >
      <h2 id='current-tab-subtitles-heading' className='sr-only'>
        {t('v2_local_subtitles_current_tab_title')}
      </h2>

      {!isAvailable && (
        <p className='flex min-w-0 items-start gap-1.5 border-b py-1.5 text-wrap text-[11px] leading-4 text-amber-800'>
          <TriangleAlertIcon className='size-4 shrink-0' />
          {t('v2_local_subtitles_role_unavailable')}
        </p>
      )}

      <dl className='min-w-0 divide-y divide-border/70'>
        <RoleSummary
          role='learning'
          subtitleId={tabInfo?.learningSubtitleId ?? null}
          subtitles={subtitles}
          defaultLanguage={learningProfile.learningLanguage}
          isAvailable={isAvailable}
          pending={pendingRoles.learning}
          onReturnToDefault={onReturnToDefault}
        />
        <RoleSummary
          role='support'
          subtitleId={tabInfo?.supportSubtitleId ?? null}
          subtitles={subtitles}
          defaultLanguage={learningProfile.supportLanguage}
          isAvailable={isAvailable}
          pending={pendingRoles.support}
          onReturnToDefault={onReturnToDefault}
        />
      </dl>
    </section>
  );
}

interface RoleSummaryProps {
  role: SubtitleRole;
  subtitleId: SubtitleId | null;
  subtitles: V2RegisteredSubtitleMetadata[];
  defaultLanguage: V2SyncStorage['learningProfile']['supportLanguage'];
  isAvailable: boolean;
  pending: boolean;
  onReturnToDefault: SubtitleRoleSummaryProps['onReturnToDefault'];
}

function RoleSummary({
  role,
  subtitleId,
  subtitles,
  defaultLanguage,
  isAvailable,
  pending,
  onReturnToDefault,
}: RoleSummaryProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selectedSubtitle = subtitles.find((subtitle) => subtitle.id === subtitleId);
  const missingSelection = subtitleId !== null && selectedSubtitle === undefined;
  const title = selectedSubtitle?.title ??
    (missingSelection
      ? t('v2_local_subtitles_selected_missing')
      : defaultLanguage === null
        ? t('v2_local_subtitles_not_configured')
        : t('v2_local_subtitles_default'));
  const language = selectedSubtitle?.language ?? defaultLanguage;
  const labelId = `subtitle-role-${role}-label`;
  const valueId = `subtitle-role-${role}-value`;
  const roleTitle = t(role === 'learning' ? 'learning_subtitle' : 'support_subtitle');

  const handleReturnToDefault = async () => {
    const succeeded = await onReturnToDefault(role, subtitleId);
    if (succeeded) rowRef.current?.focus();
  };

  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      aria-labelledby={`${labelId} ${valueId}`}
      aria-busy={pending || undefined}
      data-subtitle-role={role}
      className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-1.5 text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-ring/50'
    >
      <dt id={labelId} className='font-medium text-gray-600'>
        {roleTitle}
      </dt>
      <dd className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2'>
        <span id={valueId} className='min-w-0 truncate font-medium' title={title}>
          {title}
          {language !== null && (
            <span className='font-normal text-gray-500'> · {t(LANGUAGES[language])}</span>
          )}
        </span>
        {subtitleId !== null && (
          <Button
            variant='link'
            className='h-auto shrink-0 whitespace-nowrap p-0 text-[11px]'
            aria-label={`${roleTitle}: ${t('v2_local_subtitles_default_short')}`}
            disabled={!isAvailable || pending}
            onClick={() => void handleReturnToDefault()}
          >
            {pending ? t('v2_local_subtitles_applying') : t('v2_local_subtitles_default_short')}
          </Button>
        )}
      </dd>
    </div>
  );
}
