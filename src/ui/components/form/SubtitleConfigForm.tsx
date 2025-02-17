import useConfig from '../../hooks/useConfig';
import Checkbox from '../elements/Checkbox';
import ColorPicker from '../elements/ColorPicker';
import NumberInput from '../elements/NumberInput';
import Switch from '../elements/Switch';
import Toggle from '../elements/Toggle';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

const { PRIMARY, SECONDARY } = SETTINGS.SUBTITLES;

type SubtitleConfigFormProps = typeof PRIMARY | typeof SECONDARY;

function SubtitleConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: SubtitleConfigFormProps) {
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
      <div className={`section ${state.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className='row'>
          <label className='label'>{t('language')}</label>
          <Switch
            options={[
              { label: t('english'), value: 'en' },
              { label: t('korean'), value: 'ko' },
            ]}
            value={state.language}
            onChange={handleChange('language')}
          />
        </div>
        <div className='row'>
          <label className='label'>{t('position_reference')}</label>
          <Switch
            options={[
              { label: t('top'), value: 'top' },
              { label: t('center'), value: 'center' },
              { label: t('bottom'), value: 'bottom' },
            ]}
            value={state.positionReference}
            onChange={handleChange('positionReference')}
          />
        </div>
        <div className='row'>
          <label className='label'>{t('position_offset')}(px)</label>
          <NumberInput value={state.positionOffset} onChange={handleChange('positionOffset')} />
        </div>
        <div className='row'>
          <label className='label'>{t('subtitle_color')}</label>
          <ColorPicker value={state.color} onChange={handleChange('color')} />
        </div>
        <div className='row'>
          <label className='label'>{t('subtitle_size')}(1~10)</label>
          <NumberInput value={state.fontSize} onChange={handleChange('fontSize')} min={1} max={10} />
        </div>
        <div className='row'>
          <label className='label'>{t('font_weight')}(1~6)</label>
          <NumberInput value={state.fontWeight} onChange={handleChange('fontWeight')} min={1} max={6} />
        </div>
        <div className='row'>
          <label className='label'>{t('opacity')}(%)</label>
          <NumberInput value={state.opacity} onChange={handleChange('opacity')} min={0} max={100} />
        </div>
        <div className='row'>
          <label className='label'>{t('allow_line_break')}</label>
          <Checkbox checked={state.lineBreak} onChange={handleChange('lineBreak')} />
        </div>
      </div>
    </section>
  );
}

export default SubtitleConfigForm;
