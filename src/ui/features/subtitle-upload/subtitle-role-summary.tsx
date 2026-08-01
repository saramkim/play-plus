import { useRef } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { TabInfo } from '@storage/tab';
import { StorageSchema, SubtitleMetadata } from '@storage/type';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';
import { TriangleAlertIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { PendingSubtitleRoles, SubtitleRole } from '@/ui/features/subtitle/use-subtitle-settings';

interface SubtitleRoleSummaryProps {
  subtitles: SubtitleMetadata[];
  tabInfo: TabInfo | null;
  primaryConfig: StorageSchema['primarySubtitle'];
  secondaryConfig: StorageSchema['secondarySubtitle'];
  isAvailable: boolean;
  pendingRoles: PendingSubtitleRoles;
  onReturnToDefault: (
    role: SubtitleRole,
    previousSubtitleId: SubtitleId | null,
    previousDelay: number
  ) => Promise<boolean>;
}

export function SubtitleRoleSummary({
  subtitles,
  tabInfo,
  primaryConfig,
  secondaryConfig,
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
        {t('current_tab_subtitles')}
      </h2>

      {!isAvailable && (
        <p className='flex min-w-0 items-start gap-1.5 border-b py-1.5 text-wrap text-[11px] leading-4 text-amber-800'>
          <TriangleAlertIcon className='size-4 shrink-0' />
          {t('subtitle_role_unavailable')}
        </p>
      )}

      <dl className='min-w-0 divide-y divide-border/70'>
        <RoleSummary
          role='primary'
          subtitleId={tabInfo?.primarySubtitle ?? null}
          subtitles={subtitles}
          defaultLanguage={primaryConfig.language}
          displayEnabled={primaryConfig.enabled}
          isAvailable={isAvailable}
          pending={pendingRoles.primary}
          onReturnToDefault={onReturnToDefault}
        />
        <RoleSummary
          role='secondary'
          subtitleId={tabInfo?.secondarySubtitle ?? null}
          subtitles={subtitles}
          defaultLanguage={secondaryConfig.language}
          displayEnabled={secondaryConfig.enabled}
          isAvailable={isAvailable}
          pending={pendingRoles.secondary}
          onReturnToDefault={onReturnToDefault}
        />
      </dl>
    </section>
  );
}

interface RoleSummaryProps {
  role: SubtitleRole;
  subtitleId: SubtitleId | null;
  subtitles: SubtitleMetadata[];
  defaultLanguage: StorageSchema['primarySubtitle']['language'];
  displayEnabled: boolean;
  isAvailable: boolean;
  pending: boolean;
  onReturnToDefault: SubtitleRoleSummaryProps['onReturnToDefault'];
}

function RoleSummary({
  role,
  subtitleId,
  subtitles,
  defaultLanguage,
  displayEnabled,
  isAvailable,
  pending,
  onReturnToDefault,
}: RoleSummaryProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const selectedSubtitle = subtitles.find((subtitle) => subtitle.id === subtitleId);
  const missingSelection = subtitleId !== null && selectedSubtitle === undefined;
  const title = selectedSubtitle?.title ?? (missingSelection ? t('selected_subtitle_missing') : t('default_subtitle'));
  const language = selectedSubtitle?.language ?? defaultLanguage;
  const previousDelay = selectedSubtitle?.delay ?? 0;
  const labelId = `subtitle-role-${role}-label`;
  const valueId = `subtitle-role-${role}-value`;

  const handleReturnToDefault = async () => {
    const succeeded = await onReturnToDefault(role, subtitleId, previousDelay);
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
        {role === 'primary' ? t('primary_short') : t('secondary_short')}
      </dt>
      <dd className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2'>
        <span id={valueId} className='flex min-w-0 items-center gap-1.5'>
          <span className='min-w-0 truncate font-medium' title={title}>
            {title} <span className='font-normal text-gray-500'>· {t(LANGUAGES[language])}</span>
          </span>
          {!displayEnabled && (
            <span className='shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-normal text-gray-600'>
              {t('display_off')}
            </span>
          )}
        </span>
        {subtitleId !== null && (
          <Button
            variant='link'
            className='h-auto shrink-0 whitespace-nowrap p-0 text-[11px]'
            aria-label={role === 'primary' ? t('return_primary_to_default') : t('return_secondary_to_default')}
            disabled={!isAvailable || pending}
            onClick={() => void handleReturnToDefault()}
          >
            {pending ? t('applying') : t('default_short')}
          </Button>
        )}
      </dd>
    </div>
  );
}
