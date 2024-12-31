import { getMessage } from '../utils/i18n';
import { SETTINGS } from '../utils/constants';
import Toggle from '../components/Toggle';
import KeydownInput from '../components/KeydownInput';
import NumberInput from '../components/NumberInput';
import Dropdown from '../components/Dropdown';
import useConfig from '../hooks/useConfig';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

type VideoSkipConfigFormProps = typeof VIDEO_SKIP | typeof SUB_VIDEO_SKIP;

function VideoSkipConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: VideoSkipConfigFormProps) {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{getMessage(TITLE_MESSAGE_KEY)}</h2>
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
          <label className='label'>{getMessage('backward_key')}</label>
          <KeydownInput value={state.backward} onChange={handleChange('backward')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('forward_key')}</label>
          <KeydownInput value={state.forward} onChange={handleChange('forward')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('skip_unit')}</label>
          <NumberInput value={state.skipTime} onChange={handleChange('skipTime')} min={1} />
          <Dropdown
            options={[
              { label: getMessage('seconds'), value: 'seconds' },
              { label: getMessage('minutes'), value: 'minutes' },
              { label: getMessage('subtitles'), value: 'subtitles' },
            ]}
            value={state.skipTimeUnit}
            onChange={handleChange('skipTimeUnit')}
          />
        </div>
      </div>
    </section>
  );
}

export default VideoSkipConfigForm;
