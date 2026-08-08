import { useEffect, useMemo, useState } from 'react';

import { createV2FirstEntryStorage, V2FirstEntryShortcutChoices } from '@storage/v2/first-entry-storage';
import { learningProfileSchema, migrationStateSchema } from '@storage/v2/schema';
import type { V2MigrationState, V2SyncStorage } from '@storage/v2/type';
import { t } from '@utils/i18n';
import { formatShortcutCode } from '@utils/shortcut-code';

import { Button } from '@/ui/components/button';
import { LearningProfileConfirmation } from '@/ui/features/learning-settings/learning-profile-confirmation';

export const V2_ONBOARDING_COMPLETE_KEY = 'v2OnboardingComplete';

const firstEntryStorage = createV2FirstEntryStorage({
  local: chrome.storage.local,
  sync: chrome.storage.sync,
});

interface FirstEntryProps {
  onComplete: () => void | Promise<void>;
}

type FirstEntryData = {
  learningProfile: V2SyncStorage['learningProfile'];
  migrationState: V2MigrationState;
};

export function FirstEntry({ onComplete }: FirstEntryProps) {
  const [data, setData] = useState<FirstEntryData | null>(null);
  const [choices, setChoices] = useState<V2FirstEntryShortcutChoices>({});
  const [error, setError] = useState(false);
  const shortcutDisplayLocale = chrome.i18n.getUILanguage?.() ?? 'en';

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      chrome.storage.sync.get('learningProfile'),
      chrome.storage.local.get('migrationState'),
    ])
      .then(([sync, local]) => {
        if (cancelled) return;
        setData({
          learningProfile: learningProfileSchema.parse(sync.learningProfile),
          migrationState: migrationStateSchema.parse(local.migrationState),
        });
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allChoicesMade = useMemo(() => {
    if (!data) return false;
    return data.migrationState.shortcutConfirmations.every(({ field }) =>
      Object.prototype.hasOwnProperty.call(choices, field)
    );
  }, [choices, data]);

  if (error) {
    return (
      <div className='flex h-screen flex-col items-center justify-center gap-3 p-6 text-center'>
        <p role='alert' className='text-wrap text-sm text-destructive'>{t('v2_first_entry_load_error')}</p>
        <Button type='button' onClick={() => window.location.reload()}>{t('v2_retry')}</Button>
      </div>
    );
  }
  if (!data) return <p role='status' className='p-6 text-center text-sm'>{t('v2_first_entry_loading')}</p>;

  const confirm = async (learningProfile: V2SyncStorage['learningProfile']) => {
    if (!allChoicesMade) return;
    setError(false);
    try {
      await firstEntryStorage.confirm({ learningProfile, shortcutChoices: choices });
      localStorage.setItem(V2_ONBOARDING_COMPLETE_KEY, 'true');
      localStorage.removeItem('isOnboardingComplete');
      localStorage.removeItem('page-store');
      await onComplete();
    } catch {
      setError(true);
    }
  };

  return (
    <main className='flex h-screen min-h-0 flex-col'>
      <header className='shrink-0 border-b p-4'>
        <h1 className='text-lg font-bold text-primary'>{t('v2_first_entry_title')}</h1>
        <p className='mt-1 text-wrap text-sm text-muted-foreground'>{t('v2_first_entry_description')}</p>
      </header>
      <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
        {data.migrationState.shortcutConfirmations.length > 0 && (
          <section className='space-y-3 rounded-lg border p-3' aria-labelledby='shortcut-confirmation-title'>
            <h2 id='shortcut-confirmation-title' className='text-sm font-semibold'>{t('v2_first_entry_shortcuts_title')}</h2>
            {data.migrationState.shortcutConfirmations.map((confirmation) => (
              <fieldset key={confirmation.field} className='space-y-2 rounded-md border p-3'>
                <legend className='px-1 text-sm font-medium'>{shortcutFieldLabel(confirmation.field)}</legend>
                <p className='text-wrap text-xs text-muted-foreground'>{shortcutReasonLabel(confirmation.reason)}</p>
                {confirmation.candidates.map((candidate, index) => (
                  <label key={`${candidate.source}-${candidate.shortcut}-${index}`} className='flex items-center gap-2 text-sm'>
                    <input
                      type='radio'
                      name={confirmation.field}
                      checked={choices[confirmation.field] === candidate.shortcut}
                      onChange={() => setChoices((current) => ({ ...current, [confirmation.field]: candidate.shortcut }))}
                    />
                    <kbd className='rounded border px-1.5 py-0.5'>
                      {formatShortcutCode(candidate.shortcut, shortcutDisplayLocale)}
                    </kbd>
                  </label>
                ))}
                <label className='flex items-center gap-2 text-sm'>
                  <input
                    type='radio'
                    name={confirmation.field}
                    checked={choices[confirmation.field] === null}
                    onChange={() => setChoices((current) => ({ ...current, [confirmation.field]: null }))}
                  />
                  <span>{t('v2_first_entry_disable_shortcut')}</span>
                </label>
              </fieldset>
            ))}
          </section>
        )}
        <LearningProfileConfirmation
          value={data.learningProfile}
          submitDisabled={!allChoicesMade}
          onConfirm={confirm}
        />
      </div>
    </main>
  );
}

const shortcutFieldLabel = (field: V2MigrationState['shortcutConfirmations'][number]['field']) => {
  if (field === 'saveCard') return t('v2_save_learning_card');
  if (field === 'previousCue') return t('v2_previous_learning_cue');
  if (field === 'nextCue') return t('v2_next_learning_cue');
  if (field === 'repeatCurrentCue') return t('v2_repeat_current_learning_cue');
  if (field === 'speedIncrease') return t('increase_speed');
  if (field === 'speedDecrease') return t('decrease_speed');
  return t('reset_speed');
};

const shortcutReasonLabel = (reason: V2MigrationState['shortcutConfirmations'][number]['reason']) => {
  if (reason === 'multiple-candidates') return t('v2_first_entry_reason_multiple_candidates');
  if (reason === 'ambiguous-semantics') return t('v2_first_entry_reason_ambiguous_semantics');
  return t('v2_first_entry_reason_conflict');
};
