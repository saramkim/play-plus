import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { KeydownInput } from '@/ui/components/keydown-input';
import { NumberInput } from '@/ui/components/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Switch } from '@/ui/components/switch';
import { useConfig } from '@/ui/hooks/use-config';

type VideoSkipConfigFormProps = typeof SETTINGS.VIDEO_SKIP | typeof SETTINGS.SUB_VIDEO_SKIP;

export function VideoSkipConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: VideoSkipConfigFormProps) {
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
