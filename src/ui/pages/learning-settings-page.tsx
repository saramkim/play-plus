import { useEffect, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { V2SyncStorage } from '@storage/v2/type';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
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

type ControlSettings = Pick<V2SyncStorage, 'learningControls' | 'playbackSpeed' | 'shortcuts'>;

export function LearningSettingsPage({ store }: LearningSettingsPageProps) {
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const learningProfile = store((state) => state.learningProfile);
  const subtitleDisplay = store((state) => state.subtitleDisplay);
  const learningControls = store((state) => state.learningControls);
  const shortcuts = store((state) => state.shortcuts);
  const playbackSpeed = store((state) => state.playbackSpeed);
  const error = store((state) => state.error);
  const setLearningProfile = store((state) => state.setLearningProfile);
  const setSubtitleDisplay = store((state) => state.setSubtitleDisplay);
  const setLearningControls = store((state) => state.setLearningControls);
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
    <div className='flex h-full min-h-0 flex-col'>
      <h2 tabIndex={-1} className='shrink-0 border-b p-4 text-base font-semibold outline-none'>
        {t('learning_languages')}
      </h2>
      <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
        <LearningProfileForm value={learningProfile} onSubmit={saveLearningProfile} />
        <SubtitleDisplayForm
          learningProfile={learningProfile}
          value={subtitleDisplay}
          onSubmit={setSubtitleDisplay}
        />
        <LearningControlsForm
          value={{ learningControls, playbackSpeed, shortcuts }}
          onSubmit={setLearningControls}
        />
      </div>
    </div>
  );
}

function LearningControlsForm({
  onSubmit,
  value,
}: {
  onSubmit: (value: ControlSettings) => Promise<void>;
  value: ControlSettings;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(value), [value]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(false);
    try {
      await onSubmit(draft);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className='flex flex-col gap-3 rounded-lg border p-3' onSubmit={save}>
      <h3 className='text-sm font-semibold'>{t('shortcuts')}</h3>
      <SwitchRow
        label={t('shortcuts')}
        checked={draft.shortcuts.enabled}
        onChange={(enabled) => setDraft((current) => ({ ...current, shortcuts: { ...current.shortcuts, enabled } }))}
      />
      <ShortcutRow
        label={t('v2_save_learning_card')}
        value={draft.shortcuts.saveCard}
        disabled={!draft.shortcuts.enabled}
        onChange={(saveCard) => setDraft((current) => ({ ...current, shortcuts: { ...current.shortcuts, saveCard } }))}
      />
      {(['previousCue', 'nextCue', 'repeatCurrentCue'] as const).map((field) => (
        <div key={field} className='grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border p-2'>
          <ShortcutRow
            label={controlLabel(field)}
            value={draft.shortcuts[field]}
            disabled={!draft.shortcuts.enabled || !draft.learningControls[field].enabled}
            onChange={(shortcut) =>
              setDraft((current) => ({
                ...current,
                shortcuts: { ...current.shortcuts, [field]: shortcut },
              }))
            }
          />
          <Switch
            aria-label={controlLabel(field)}
            checked={draft.learningControls[field].enabled}
            onCheckedChange={(enabled) =>
              setDraft((current) => ({
                ...current,
                learningControls: { ...current.learningControls, [field]: { enabled } },
              }))
            }
          />
        </div>
      ))}
      <SwitchRow
        label={t('playback_speed')}
        checked={draft.playbackSpeed.enabled}
        onChange={(enabled) =>
          setDraft((current) => ({ ...current, playbackSpeed: { ...current.playbackSpeed, enabled } }))
        }
      />
      {(['increase', 'decrease', 'reset'] as const).map((field) => (
        <ShortcutRow
          key={field}
          label={speedLabel(field)}
          value={draft.playbackSpeed[field]}
          disabled={!draft.playbackSpeed.enabled}
          onChange={(shortcut) =>
            setDraft((current) => ({
              ...current,
              playbackSpeed: { ...current.playbackSpeed, [field]: shortcut },
            }))
          }
        />
      ))}
      {error && <p role='alert' className='text-wrap text-sm text-destructive'>{t('error_try_later')}</p>}
      <Button type='submit' disabled={saving}>{t('save')}</Button>
    </form>
  );
}

function ShortcutRow({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className='flex min-w-0 items-center justify-between gap-2 text-sm'>
      <span className='text-wrap'>{label}</span>
      <Input
        className='w-28'
        aria-label={`${label} ${t('shortcuts')}`}
        disabled={disabled}
        placeholder='—'
        readOnly
        value={value}
        onKeyDown={(event) => {
          if (event.key === 'Tab') return;
          event.preventDefault();
          onChange(event.code === 'Backspace' || event.code === 'Delete' ? '' : event.code);
        }}
      />
    </label>
  );
}

function SwitchRow({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className='flex items-center justify-between gap-2 text-sm'>
      <span>{label}</span>
      <Switch aria-label={label} checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

const controlLabel = (field: keyof V2SyncStorage['learningControls']) => {
  if (field === 'previousCue') return t('v2_previous_learning_cue');
  if (field === 'nextCue') return t('v2_next_learning_cue');
  return t('v2_repeat_current_learning_cue');
};

const speedLabel = (field: 'increase' | 'decrease' | 'reset') => {
  if (field === 'increase') return t('increase_speed');
  if (field === 'decrease') return t('decrease_speed');
  return t('reset_speed');
};
