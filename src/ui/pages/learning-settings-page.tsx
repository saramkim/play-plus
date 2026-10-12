import { useEffect, useId, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { CONTROL_COMMANDS, CONTROL_LABELS, NavigationProfile } from '@storage/v2/control-settings';
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
  embedded?: boolean;
  store: LearningSettingsStore;
}

type ShortcutSettings = Pick<V2SyncStorage, 'playbackSpeed' | 'shortcuts'>;
type ShortcutFieldPath = `shortcuts.${(typeof CONTROL_COMMANDS)[number]}` | 'playbackSpeed.increase' | 'playbackSpeed.decrease' | 'playbackSpeed.reset';

type ShortcutValidationError =
  | { type: 'reserved' }
  | { conflictPath: ShortcutFieldPath; type: 'conflict' };

export function LearningSettingsPage({ embedded = false, store }: LearningSettingsPageProps) {
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

  const settings = (
    <>
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
    </>
  );

  if (embedded) return <div className='space-y-4'>{settings}</div>;
  return (
    <section aria-label={t('v2_nav_learning')} className='h-full min-h-0'>
      <div className='h-full min-h-0 space-y-4 overflow-y-auto p-4' data-scroll-owner='learning-settings'>
        {settings}
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
        <h2 id={shortcutsTitleId} className='text-[15px] font-semibold'>{t('shortcuts')}</h2>
        <p id={shortcutHintId} className='text-wrap text-xs text-muted-foreground'>{t('v2_shortcut_capture_hint')}</p>
        {(['primary', 'secondary'] as const).map((profile) => <NavigationFields
          key={profile} label={t(profile === 'primary' ? 'v2_primary_navigation' : 'v2_secondary_navigation')}
          value={draft.shortcuts.navigation[profile]}
          onChange={(value) => setDraft((current) => ({ ...current, shortcuts: {
            ...current.shortcuts, navigation: { ...current.shortcuts.navigation, [profile]: value },
          } }))} />)}
        {CONTROL_COMMANDS.map((field) => <div key={field} className='flex items-center gap-2'>
          <Switch aria-label={t('v2_enable_command', t(CONTROL_LABELS[field]))}
            checked={draft.shortcuts[field].enabled}
            onCheckedChange={(enabled) => setDraft((current) => ({ ...current, shortcuts: {
              ...current.shortcuts, [field]: { ...current.shortcuts[field], enabled },
            } }))} />
          <ShortcutRow descriptionId={shortcutHintId} disabled={saving}
            error={errorMessage(`shortcuts.${field}`)} label={t(CONTROL_LABELS[field])} value={draft.shortcuts[field].key}
            onChange={(key) => setDraft((current) => ({ ...current, shortcuts: {
              ...current.shortcuts, [field]: { ...current.shortcuts[field], key },
            } }))} />
        </div>)}
      </section>
      <section aria-labelledby={playbackSpeedTitleId} className='flex flex-col gap-2'>
        <h3 id={playbackSpeedTitleId} className='text-[15px] font-semibold'>{t('playback_speed')}</h3>
        {(['increase', 'decrease', 'reset'] as const).map((field) => <div key={field} className='flex items-center gap-2'>
          <Switch aria-label={t('v2_enable_command', speedLabel(field))} checked={draft.playbackSpeed[field].enabled}
            onCheckedChange={(enabled) => setDraft((current) => ({ ...current, playbackSpeed: {
              ...current.playbackSpeed, [field]: { ...current.playbackSpeed[field], enabled },
            } }))} />
          <ShortcutRow descriptionId={shortcutHintId} disabled={saving} error={errorMessage(`playbackSpeed.${field}`)}
            label={speedLabel(field)} value={draft.playbackSpeed[field].key}
            onChange={(key) => setDraft((current) => ({ ...current, playbackSpeed: {
              ...current.playbackSpeed, [field]: { ...current.playbackSpeed[field], key },
            } }))} />
        </div>)}
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
    <div className='flex min-w-0 flex-1 flex-col gap-1'>
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

function NavigationFields({ label, onChange, value }: {
  label: string; onChange: (value: NavigationProfile) => void; value: NavigationProfile;
}) {
  return <fieldset className='flex flex-col gap-2 rounded-md border p-2'>
    <legend className='text-sm'>{label}</legend>
    <label className='flex items-center justify-between gap-2 text-sm'>{t('v2_navigation_amount')}
      <input aria-label={`${label} ${t('v2_navigation_amount')}`} className='w-20 rounded border p-1' type='number' min='1'
        value={value.amount} onChange={(event) => onChange({ ...value, amount: Number(event.target.value) })} />
    </label>
    <label className='flex items-center justify-between gap-2 text-sm'>{t('v2_navigation_unit')}
      <select value={value.unit} onChange={(event) => onChange({ ...value, unit: event.target.value as NavigationProfile['unit'] })}>
        <option value='subtitles'>{t('v2_unit_cues')}</option><option value='seconds'>{t('v2_unit_seconds')}</option><option value='minutes'>{t('v2_unit_minutes')}</option>
      </select>
    </label>
    <label className='flex items-center justify-between gap-2 text-sm'>{t('v2_navigation_fallback')}
      <Switch checked={value.fallbackEnabled} onCheckedChange={(fallbackEnabled) => onChange({ ...value, fallbackEnabled })} />
    </label>
    <label className='flex items-center justify-between gap-2 text-sm'>{t('v2_fallback_amount')}
      <input className='w-20 rounded border p-1' type='number' min='0' value={value.fallbackAmount}
        onChange={(event) => onChange({ ...value, fallbackAmount: Number(event.target.value) })} />
      <select aria-label={t('v2_fallback_unit')} value={value.fallbackUnit}
        onChange={(event) => onChange({ ...value, fallbackUnit: event.target.value as NavigationProfile['fallbackUnit'] })}>
        <option value='seconds'>{t('v2_unit_seconds')}</option><option value='minutes'>{t('v2_unit_minutes')}</option>
      </select>
    </label>
  </fieldset>;
}

const speedLabel = (field: 'increase' | 'decrease' | 'reset') => {
  if (field === 'increase') return t('increase_speed');
  if (field === 'decrease') return t('decrease_speed');
  return t('reset_speed');
};

const shortcutLabel = (path: ShortcutFieldPath) => {
  const [group, field] = path.split('.');
  return group === 'shortcuts' ? t(CONTROL_LABELS[field as (typeof CONTROL_COMMANDS)[number]])
    : speedLabel(field as 'increase' | 'decrease' | 'reset');
};

const getShortcutValidationErrors = (settings: ShortcutSettings) => {
  const errors = new Map<ShortcutFieldPath, ShortcutValidationError>();
  const owners = new Map<string, ShortcutFieldPath[]>();

  for (const path of SHORTCUT_FIELD_PATHS) {
    const binding = getShortcutValue(settings, path);
    const shortcut = binding.key;
    if (!shortcut) continue;
    if (isReservedV2Shortcut(shortcut)) errors.set(path, { type: 'reserved' });
    if (!binding.enabled) continue;
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
  const [group, field] = path.split('.');
  return group === 'shortcuts' ? settings.shortcuts[field as (typeof CONTROL_COMMANDS)[number]]
    : settings.playbackSpeed[field as 'increase' | 'decrease' | 'reset'];
};

const shortcutSettingsEqual = (left: ShortcutSettings, right: ShortcutSettings) => JSON.stringify(left) === JSON.stringify(right);

const SHORTCUT_FIELD_PATHS: ShortcutFieldPath[] = [
  ...CONTROL_COMMANDS.map((field) => `shortcuts.${field}` as const),
  'playbackSpeed.increase', 'playbackSpeed.decrease', 'playbackSpeed.reset',
];
