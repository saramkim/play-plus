import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/elements/button';
import { KeydownInput } from '@/ui/components/elements/keydown-input';
import { Switch } from '@/ui/components/ui/switch';
import { useConfig } from '@/ui/hooks/use-config';

const { STORAGE_KEY } = SETTINGS.LOOP;

export function LoopConfigForm() {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{t('loop')}</h2>
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
          <label className='label'>{t('toggle_loop_key')} </label>
          <KeydownInput value={state.toggleLoop} onChange={handleChange('toggleLoop')} />
        </div>
        <div className='row'>
          <label className='label'>{t('start_point_key')} </label>
          <KeydownInput value={state.startPoint} onChange={handleChange('startPoint')} />
        </div>
        <div className='row'>
          <label className='label'>{t('end_point_key')} </label>
          <KeydownInput value={state.endPoint} onChange={handleChange('endPoint')} />
        </div>
        <div className='row'>
          <label className='label'>{t('loop_current_subtitle')} </label>
          <KeydownInput value={state.loopCurrentSubtitle} onChange={handleChange('loopCurrentSubtitle')} />
        </div>
      </div>
    </section>
  );
}
