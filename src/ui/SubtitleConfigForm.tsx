import { SETTINGS } from '../utils/constants';
import { getMessage } from '../utils/i18n';
import Toggle from '../components/Toggle';
import Switch from '../components/Switch';
import NumberInput from '../components/NumberInput';
import ColorPicker from '../components/ColorPicker';
import Checkbox from '../components/Checkbox';
import useConfig from '../hooks/useConfig';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

type SubtitleConfigFormProps = typeof PRIMARY | typeof SECONDARY;

function SubtitleConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: SubtitleConfigFormProps) {
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
          <label className='label'>{getMessage('language')}</label>
          <Switch
            options={[
              { label: getMessage('english'), value: 'en' },
              { label: getMessage('korean'), value: 'ko' },
            ]}
            value={state.language}
            onChange={handleChange('language')}
          />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('position_reference')}</label>
          <Switch
            options={[
              { label: getMessage('top'), value: 'top' },
              { label: getMessage('center'), value: 'center' },
              { label: getMessage('bottom'), value: 'bottom' },
            ]}
            value={state.positionReference}
            onChange={handleChange('positionReference')}
          />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('position_offset')}(px)</label>
          <NumberInput value={state.positionOffset} onChange={handleChange('positionOffset')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('subtitle_color')}</label>
          <ColorPicker value={state.color} onChange={handleChange('color')} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('subtitle_size')}(1~10)</label>
          <NumberInput value={state.fontSize} onChange={handleChange('fontSize')} min={1} max={10} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('font_weight')}(1~6)</label>
          <NumberInput value={state.fontWeight} onChange={handleChange('fontWeight')} min={1} max={6} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('opacity')}(%)</label>
          <NumberInput value={state.opacity} onChange={handleChange('opacity')} min={0} max={100} />
        </div>
        <div className='row'>
          <label className='label'>{getMessage('allow_line_break')}</label>
          <Checkbox checked={state.lineBreak} onChange={handleChange('lineBreak')} />
        </div>
      </div>
    </section>
  );
}

export default SubtitleConfigForm;
