import useConfig from '../../hooks/useConfig';
import KeydownInput from '../elements/KeydownInput';
import Toggle from '../elements/Toggle';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

const { STORAGE_KEY } = SETTINGS.LOOP;

function LoopConfigForm() {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{t('loop')}</h2>
        <div className='row'>
          {hasChanged ? (
            <>
              <button onClick={handleCancel} className='button bg-gray-500'>
                {t('cancel')}
              </button>
              <button onClick={handleSave} className='button bg-teal-500'>
                {t('save')}
              </button>
            </>
          ) : (
            <Toggle isOn={state.enabled} onChange={handleChange('enabled')} />
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

export default LoopConfigForm;
