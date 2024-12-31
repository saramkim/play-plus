import { getMessage } from '../utils/i18n';
import { SETTINGS } from '../utils/constants';
import Toggle from '../components/Toggle';
import KeydownInput from '../components/KeydownInput';
import useConfig from '../hooks/useConfig';

const { STORAGE_KEY } = SETTINGS.SHORTCUTS;

function ShortcutsConfigForm() {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{getMessage('shortcuts')}</h2>
        <div className='row'>
          {hasChanged ? (
            <>
              <button onClick={handleCancel} className='button bg-gray-500'>
                {getMessage('cancel')}
              </button>
              <button onClick={handleSave} className='button bg-teal-500'>
                {getMessage('save')}
              </button>
            </>
          ) : (
            <Toggle isOn={state.enabled} onChange={handleChange('enabled')} />
          )}
        </div>
      </header>
      <div className='section'>
        <div className='row'>
          <label className='label'>{getMessage('save_primary_subtitle')} </label>
          <KeydownInput value={state.savePrimary} onChange={handleChange('savePrimary')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('save_secondary_subtitle')} </label>
          <KeydownInput value={state.saveSecondary} onChange={handleChange('saveSecondary')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('toggle_primary_subtitle')} </label>
          <KeydownInput value={state.togglePrimary} onChange={handleChange('togglePrimary')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('toggle_secondary_subtitle')} </label>
          <KeydownInput value={state.toggleSecondary} onChange={handleChange('toggleSecondary')} />
        </div>
      </div>
    </section>
  );
}

export default ShortcutsConfigForm;
