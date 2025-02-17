import useConfig from '../../hooks/useConfig';
import KeydownInput from '../elements/KeydownInput';
import Toggle from '../elements/Toggle';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

const { STORAGE_KEY } = SETTINGS.SHORTCUTS;

function ShortcutsConfigForm() {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{t('shortcuts')}</h2>
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

export default ShortcutsConfigForm;
