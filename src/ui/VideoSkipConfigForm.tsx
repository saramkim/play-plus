import { t } from '../utils/i18n';
import { SETTINGS } from '../utils/constants';
import Toggle from '../components/Toggle';
import KeydownInput from '../components/KeydownInput';
import NumberInput from '../components/NumberInput';
import DropdownButton from '../components/DropdownButton';
import useConfig from '../hooks/useConfig';

const { VIDEO_SKIP, SUB_VIDEO_SKIP } = SETTINGS;

type VideoSkipConfigFormProps = typeof VIDEO_SKIP | typeof SUB_VIDEO_SKIP;

function VideoSkipConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: VideoSkipConfigFormProps) {
  const { state, hasChanged, handleChange, handleSave, handleCancel } = useConfig(STORAGE_KEY);

  return (
    <section className='section'>
      <header className='section-header'>
        <h2 className='section-title'>{t(TITLE_MESSAGE_KEY)}</h2>
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
      <div className='section'>
        <div className='row'>
          <label className='label'>{t('backward_key')}</label>
          <KeydownInput value={state.backward} onChange={handleChange('backward')} />
        </div>
        <div className='row'>
          <label className='label'>{t('forward_key')}</label>
          <KeydownInput value={state.forward} onChange={handleChange('forward')} />
        </div>
        <div className='row'>
          <label className='label'>{t('skip_unit')}</label>
          <NumberInput value={state.skipTime} onChange={handleChange('skipTime')} min={1} />
          <DropdownButton
            options={[
              { label: t('seconds'), value: 'seconds' },
              { label: t('minutes'), value: 'minutes' },
              { label: t('subtitles'), value: 'subtitles' },
            ]}
            value={state.skipTimeUnit}
            onChange={handleChange('skipTimeUnit')}
          />
        </div>
        {state.skipTimeUnit === 'subtitles' && (
          <div className='row'>
            <label className='label'>{t('fallback_unit')}</label>
            <NumberInput value={state.fallbackTime} onChange={handleChange('fallbackTime')} min={1} />
            <DropdownButton
              options={[
                { label: t('seconds'), value: 'seconds' },
                { label: t('minutes'), value: 'minutes' },
              ]}
              value={state.fallbackUnit}
              onChange={handleChange('fallbackUnit')}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export default VideoSkipConfigForm;
