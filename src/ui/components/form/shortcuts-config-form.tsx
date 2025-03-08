import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/elements/button';
import { KeydownInput } from '@/ui/components/elements/keydown-input';
import { Switch } from '@/ui/components/ui/switch';
import { useConfig } from '@/ui/hooks/use-config';

const { STORAGE_KEY } = SETTINGS.SHORTCUTS;

export function ShortcutsConfigForm() {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{t('shortcuts')}</h2>
        <div className='row'>
          {hasChanged ? (
            <>
              <Button variant='outline' size='sm' onClick={handleCancel}>
                {t('cancel')}
              </Button>
              <Button size='sm' onClick={handleSave}>
                {t('save')}
              </Button>
            </>
          ) : (
            <Switch checked={state.enabled} onCheckedChange={handleChange('enabled')} />
          )}
        </div>
      </header>
      <div className={`section ${state.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className='row'>
          <label className='label'>{t('save_primary_subtitle')} </label>
          <KeydownInput value={state.savePrimary} onChange={handleChange('savePrimary')} />
        </div>
        <div className='row'>
          <label className='label'>{t('save_secondary_subtitle')} </label>
          <KeydownInput value={state.saveSecondary} onChange={handleChange('saveSecondary')} />
        </div>
        <div className='row'>
          <label className='label'>{t('toggle_primary_subtitle')} </label>
          <KeydownInput value={state.togglePrimary} onChange={handleChange('togglePrimary')} />
        </div>
        <div className='row'>
          <label className='label'>{t('toggle_secondary_subtitle')} </label>
          <KeydownInput value={state.toggleSecondary} onChange={handleChange('toggleSecondary')} />
        </div>
      </div>
    </section>
  );
}
