import { useEffect, useId, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { isReservedV2Shortcut, v2SyncStorageSchema } from '@storage/v2/schema';
import { V2SyncStorage } from '@storage/v2/type';
import { t } from '@utils/i18n';
import { formatShortcutCode } from '@utils/shortcut-code';
import { LoaderCircleIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Switch } from '@/ui/components/switch';
import { LearningProfileForm } from '@/ui/features/learning-settings/learning-profile-form';
import { LearningSettingsStore } from '@/ui/features/learning-settings/learning-settings-store';
import { SubtitleDisplayForm } from '@/ui/features/learning-settings/subtitle-display-form';
import { clearSubtitleRolesWithRollback } from '@/ui/features/subtitle/subtitle-role-transaction';
import { useSubtitleSettings } from '@/ui/features/subtitle/use-subtitle-settings';
import { useTabStore } from '@/ui/store/tab-store';

interface LearningSettingsPageProps {
  store: LearningSettingsStore;
}

type ShortcutSettings = Pick<V2SyncStorage, 'playbackSpeed' | 'shortcuts'>;
type ShortcutFieldPath =
  | 'shortcuts.saveCard'
  | 'shortcuts.previousCue'
  | 'shortcuts.nextCue'
  | 'shortcuts.repeatCurrentCue'
  | 'playbackSpeed.increase'
  | 'playbackSpeed.decrease'
  | 'playbackSpeed.reset';

type ShortcutValidationError =
  | { type: 'reserved' }
  | { conflictPath: ShortcutFieldPath; type: 'conflict' };

export function LearningSettingsPage({ store }: LearningSettingsPageProps) {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const learningProfile = store((state) => state.learningProfile);
  const subtitleDisplay = store((state) => state.subtitleDisplay);
  const shortcuts = store((state) => state.shortcuts);
  const playbackSpeed = store((state) => state.playbackSpeed);
  const error = store((state) => state.error);
  const setLearningProfile = store((state) => state.setLearningProfile);
  const setSubtitleDisplay = store((state) => state.setSubtitleDisplay);
  const setShortcutSettings = store((state) => state.setShortcutSettings);
  const { useAsSubtitle } = useSubtitleSettings(activeTab, tabInfo, learningProfile);

  const saveLearningProfile = async (value: V2SyncStorage['learningProfile']) => {
    const selections = [
      ...(value.learningLanguage !== learningProfile.learningLanguage && tabInfo?.learningSubtitleId
        ? [{ role: 'learning' as const, subtitleId: tabInfo.learningSubtitleId as SubtitleId }]
        : []),
      ...(value.supportLanguage !== learningProfile.supportLanguage && tabInfo?.supportSubtitleId
        ? [{ role: 'support' as const, subtitleId: tabInfo.supportSubtitleId as SubtitleId }]
        : []),
    ];
    const rollback = await clearSubtitleRolesWithRollback(selections, useAsSubtitle);
    try {
      await setLearningProfile(value);
    } catch (error) {
      try {
        await rollback();
      } catch {
        // The stored profile remains unchanged, so the subtitle can be selected again manually.
      }
      throw error;
    }
  };

  if (error) {
    return <p role='alert' className='p-4 text-wrap text-sm text-destructive'>{t('error_try_later')}</p>;
  }

  return (
    <section aria-label={t('v2_nav_learning')} className='h-full min-h-0'>
      <div className='h-full min-h-0 space-y-4 overflow-y-auto p-4' data-scroll-owner='learning-settings'>
        <LearningProfileForm
          settingsPresentation
          submitRequiresDirty
          value={learningProfile}
          onSubmit={saveLearningProfile}
        />
        <SubtitleDisplayForm
          learningProfile={learningProfile}
          value={subtitleDisplay}
          onSubmit={setSubtitleDisplay}
        />
        <ShortcutSettingsForm
          validationContext={{ learningProfile, subtitleDisplay }}
          value={{ playbackSpeed, shortcuts }}
          onSubmit={setShortcutSettings}
        />
      </div>
    </section>
  );
}

function ShortcutSettingsForm({
  onSubmit,
  validationContext,
  value,
}: {
  onSubmit: (value: ShortcutSettings) => Promise<void>;
  validationContext: Pick<V2SyncStorage, 'learningProfile' | 'subtitleDisplay'>;
  value: ShortcutSettings;
}) {
  const [draft, setDraft] = useState(value);
  const [submitError, setSubmitError] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentExternalValueRef = useRef(value);
  const externalValueRef = useRef(value);
  const submittedValueRef = useRef<ShortcutSettings | null>(null);
  const shortcutHintId = useId();
  const shortcutsTitleId = useId();
  const playbackSpeedTitleId = useId();
  currentExternalValueRef.current = value;

  useEffect(() => {
    if (shortcutSettingsEqual(externalValueRef.current, value)) return;
    externalValueRef.current = value;
    const submittedValue = submittedValueRef.current;
    if (submittedValue === null || !shortcutSettingsEqual(submittedValue, value)) {
      setDraft(value);
    }
    submittedValueRef.current = null;
    setSubmitError(false);
  }, [value]);

  const validationErrors = getShortcutValidationErrors(draft);
  const isDirty = !shortcutSettingsEqual(draft, value);
  const isValid =
    validationErrors.size === 0 && v2SyncStorageSchema.safeParse({ ...validationContext, ...draft }).success;
  const canSave = isDirty && isValid;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving) return;
    const externalValueAtSubmit = currentExternalValueRef.current;
    const submittedValue = structuredClone(draft);
    setSaving(true);
    setSubmitError(false);
    submittedValueRef.current = submittedValue;
    try {
      await onSubmit(submittedValue);
    } catch {
      const currentExternalValue = currentExternalValueRef.current;
      const supersededByExternalValue =
        !shortcutSettingsEqual(currentExternalValue, externalValueAtSubmit) &&
        !shortcutSettingsEqual(currentExternalValue, submittedValue);
      if (supersededByExternalValue) return;

      submittedValueRef.current = null;
      setSubmitError(true);
    } finally {
      setSaving(false);
    }
  };

  const errorMessage = (path: ShortcutFieldPath) => {
    const error = validationErrors.get(path);
    if (!error) return undefined;
    if (error.type === 'reserved') return t('v2_shortcut_reserved_error');
    return t('v2_shortcut_conflict_error', shortcutLabel(error.conflictPath));
  };

  return (
    <form
      aria-busy={saving || undefined}
      aria-labelledby={shortcutsTitleId}
      className='flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 shadow'
      onSubmit={save}
    >
      <section aria-labelledby={shortcutsTitleId} className='flex flex-col gap-2'>
        <SwitchSectionHeading
          checked={draft.shortcuts.enabled}
          id={shortcutsTitleId}
          label={t('shortcuts')}
          level={2}
          onChange={(enabled) => setDraft((current) => ({ ...current, shortcuts: { ...current.shortcuts, enabled } }))}
        />
        <p id={shortcutHintId} className='text-wrap text-xs text-muted-foreground'>
          {t('v2_shortcut_capture_hint')}
        </p>
        <ShortcutRow
          descriptionId={shortcutHintId}
          disabled={!draft.shortcuts.enabled}
          error={errorMessage('shortcuts.saveCard')}
          label={t('v2_save_learning_card')}
          value={draft.shortcuts.saveCard}
          onChange={(saveCard) =>
            setDraft((current) => ({ ...current, shortcuts: { ...current.shortcuts, saveCard } }))
          }
        />
        {(['previousCue', 'nextCue', 'repeatCurrentCue'] as const).map((field) => {
          const path = `shortcuts.${field}` as const;
          return (
            <ShortcutRow
              key={field}
              descriptionId={shortcutHintId}
              disabled={!draft.shortcuts.enabled}
              error={errorMessage(path)}
              label={cueShortcutLabel(field)}
              value={draft.shortcuts[field]}
              onChange={(shortcut) =>
                setDraft((current) => ({
                  ...current,
                  shortcuts: { ...current.shortcuts, [field]: shortcut },
                }))
              }
            />
          );
        })}
      </section>
      <section aria-labelledby={playbackSpeedTitleId} className='flex flex-col gap-2'>
        <SwitchSectionHeading
          checked={draft.playbackSpeed.enabled}
          id={playbackSpeedTitleId}
          label={t('playback_speed')}
          level={3}
          onChange={(enabled) =>
            setDraft((current) => ({ ...current, playbackSpeed: { ...current.playbackSpeed, enabled } }))
          }
        />
        {(['increase', 'decrease', 'reset'] as const).map((field) => {
          const path = `playbackSpeed.${field}` as const;
          return (
            <ShortcutRow
              key={field}
              descriptionId={shortcutHintId}
              disabled={!draft.playbackSpeed.enabled}
              error={errorMessage(path)}
              label={speedLabel(field)}
              value={draft.playbackSpeed[field]}
              onChange={(shortcut) =>
                setDraft((current) => ({
                  ...current,
                  playbackSpeed: { ...current.playbackSpeed, [field]: shortcut },
                }))
              }
            />
          );
        })}
      </section>
      {submitError && <p role='alert' className='text-wrap text-sm text-destructive'>{t('error_try_later')}</p>}
      <Button
        aria-busy={saving || undefined}
        className='min-w-24 self-end'
        disabled={!canSave || saving}
        size='sm'
        type='submit'
        variant={saving || canSave ? 'default' : 'outline'}
      >
        {saving && <LoaderCircleIcon className='animate-spin' />}
        {saving ? t('saving') : t('save')}
      </Button>
    </form>
  );
}

function ShortcutRow({
  descriptionId,
  disabled,
  error,
  label,
  onChange,
  value,
}: {
  descriptionId: string;
  disabled: boolean;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const errorId = useId();
  const displayValue = formatShortcutCode(value, chrome.i18n.getUILanguage?.() ?? 'en');
  const accessibleValue = displayValue || t('v2_shortcut_unassigned');
  const describedBy = error ? `${descriptionId} ${errorId}` : descriptionId;

  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <label className='flex min-w-0 items-center justify-between gap-2 text-sm'>
        <span className='text-wrap'>{label}</span>
        <Button
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-label={t('v2_shortcut_capture_label', label, accessibleValue)}
          className='w-28 shrink-0 overflow-hidden font-normal'
          data-slot='shortcut-capture'
          disabled={disabled}
          size='sm'
          title={accessibleValue}
          type='button'
          value={displayValue}
          variant='outline'
          onKeyDown={(event) => {
            if (event.code === 'Tab') return;
            event.preventDefault();
            onChange(event.code === 'Backspace' || event.code === 'Delete' ? '' : event.code);
          }}
        >
          <span className='min-w-0 max-w-full truncate' data-slot='shortcut-capture-value'>
            {displayValue || '—'}
          </span>
        </Button>
      </label>
      {error && <p id={errorId} role='alert' className='text-wrap text-xs text-destructive'>{error}</p>}
    </div>
  );
}

function SwitchSectionHeading({
  checked,
  id,
  label,
  level,
  onChange,
}: {
  checked: boolean;
  id: string;
  label: string;
  level: 2 | 3;
  onChange: (value: boolean) => void;
}) {
  const heading =
    level === 2 ? (
      <h2 id={id} className='text-[15px] font-semibold'>{label}</h2>
    ) : (
      <h3 id={id} className='text-[15px] font-semibold'>{label}</h3>
    );

  return (
    <div className='flex items-center justify-between gap-2'>
      {heading}
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const cueShortcutLabel = (field: 'nextCue' | 'previousCue' | 'repeatCurrentCue') => {
  if (field === 'previousCue') return t('v2_previous_learning_cue');
  if (field === 'nextCue') return t('v2_next_learning_cue');
  return t('v2_repeat_current_learning_cue');
};

const speedLabel = (field: 'increase' | 'decrease' | 'reset') => {
  if (field === 'increase') return t('increase_speed');
  if (field === 'decrease') return t('decrease_speed');
  return t('reset_speed');
};

const shortcutLabel = (path: ShortcutFieldPath) => {
  if (path === 'shortcuts.saveCard') return t('v2_save_learning_card');
  if (path === 'shortcuts.previousCue') return t('v2_previous_learning_cue');
  if (path === 'shortcuts.nextCue') return t('v2_next_learning_cue');
  if (path === 'shortcuts.repeatCurrentCue') return t('v2_repeat_current_learning_cue');
  if (path === 'playbackSpeed.increase') return t('increase_speed');
  if (path === 'playbackSpeed.decrease') return t('decrease_speed');
  return t('reset_speed');
};

const getShortcutValidationErrors = (settings: ShortcutSettings) => {
  const errors = new Map<ShortcutFieldPath, ShortcutValidationError>();
  const owners = new Map<string, ShortcutFieldPath[]>();

  for (const path of SHORTCUT_FIELD_PATHS) {
    const shortcut = getShortcutValue(settings, path);
    if (!shortcut) continue;
    if (isReservedV2Shortcut(shortcut)) errors.set(path, { type: 'reserved' });
    owners.set(shortcut, [...(owners.get(shortcut) ?? []), path]);
  }

  for (const paths of owners.values()) {
    if (paths.length < 2) continue;
    for (const path of paths) {
      errors.set(path, { conflictPath: paths.find((candidate) => candidate !== path) ?? path, type: 'conflict' });
    }
  }

  return errors;
};

const getShortcutValue = (settings: ShortcutSettings, path: ShortcutFieldPath) => {
  if (path === 'shortcuts.saveCard') return settings.shortcuts.saveCard;
  if (path === 'shortcuts.previousCue') return settings.shortcuts.previousCue;
  if (path === 'shortcuts.nextCue') return settings.shortcuts.nextCue;
  if (path === 'shortcuts.repeatCurrentCue') return settings.shortcuts.repeatCurrentCue;
  if (path === 'playbackSpeed.increase') return settings.playbackSpeed.increase;
  if (path === 'playbackSpeed.decrease') return settings.playbackSpeed.decrease;
  return settings.playbackSpeed.reset;
};

const shortcutSettingsEqual = (left: ShortcutSettings, right: ShortcutSettings) =>
  left.shortcuts.enabled === right.shortcuts.enabled &&
  left.shortcuts.saveCard === right.shortcuts.saveCard &&
  left.shortcuts.previousCue === right.shortcuts.previousCue &&
  left.shortcuts.nextCue === right.shortcuts.nextCue &&
  left.shortcuts.repeatCurrentCue === right.shortcuts.repeatCurrentCue &&
  left.playbackSpeed.enabled === right.playbackSpeed.enabled &&
  left.playbackSpeed.increase === right.playbackSpeed.increase &&
  left.playbackSpeed.decrease === right.playbackSpeed.decrease &&
  left.playbackSpeed.reset === right.playbackSpeed.reset;

const SHORTCUT_FIELD_PATHS: ShortcutFieldPath[] = [
  'shortcuts.saveCard',
  'shortcuts.previousCue',
  'shortcuts.nextCue',
  'shortcuts.repeatCurrentCue',
  'playbackSpeed.increase',
  'playbackSpeed.decrease',
  'playbackSpeed.reset',
];
