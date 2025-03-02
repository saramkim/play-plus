import useConfig from '../../hooks/useConfig';
import { Button } from '../elements/button';
import KeydownInput from '../elements/KeydownInput';
import NumberInput from '../elements/NumberInput';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

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
          <Select value={state.skipTimeUnit} onValueChange={handleChange('skipTimeUnit')}>
            <SelectTrigger>
              <SelectValue placeholder={t('select')} />
            </SelectTrigger>
            <SelectContent>
              {[
                { label: t('seconds'), value: 'seconds' },
                { label: t('minutes'), value: 'minutes' },
                { label: t('subtitles'), value: 'subtitles' },
              ].map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {state.skipTimeUnit === 'subtitles' && (
          <div className='row'>
            <label className='label'>{t('fallback_unit')}</label>
            <NumberInput value={state.fallbackTime} onChange={handleChange('fallbackTime')} min={1} />
            <Select value={state.fallbackUnit} onValueChange={handleChange('fallbackUnit')}>
              <SelectTrigger>
                <SelectValue placeholder={t('select')} />
              </SelectTrigger>
              <SelectContent>
                {[
                  { label: t('seconds'), value: 'seconds' },
                  { label: t('minutes'), value: 'minutes' },
                ].map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </section>
  );
}

export default VideoSkipConfigForm;
