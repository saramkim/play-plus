import { EqualsIcon } from '@heroicons/react/20/solid';
import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { ColorPicker } from '@/ui/components/color-picker';
import { NumberInput } from '@/ui/components/number-input';
import { Switch } from '@/ui/components/switch';
import { Toggle } from '@/ui/components/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/toggle-group';
import { useConfig } from '@/ui/hooks/use-config';

type SubtitleConfigFormProps = typeof SETTINGS.SUBTITLES.PRIMARY | typeof SETTINGS.SUBTITLES.SECONDARY;

export function SubtitleConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: SubtitleConfigFormProps) {
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
          <label className='label'>{t('language')}</label>
          <ToggleGroup
            type='single'
            variant='outline'
            size='sm'
            className='w-full'
            onValueChange={(value) => {
              if (value === 'en' || value === 'ko') {
                handleChange('language')(value);
              }
            }}
            value={state.language}
          >
            {[
              { label: t('english'), value: 'en' },
              { label: t('korean'), value: 'ko' },
            ].map(({ label, value }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className='row'>
          <label className='label'>{t('position_reference')}</label>
          <ToggleGroup
            type='single'
            variant='outline'
            size='sm'
            className='w-full'
            onValueChange={(value) => {
              if (value === 'top' || value === 'center' || value === 'bottom') {
                handleChange('positionReference')(value);
              }
            }}
            value={state.positionReference}
          >
            {[
              { label: t('top'), value: 'top' },
              { label: t('center'), value: 'center' },
              { label: t('bottom'), value: 'bottom' },
            ].map(({ label, value }) => (
              <ToggleGroupItem key={value} value={value} aria-label={label}>
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
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
          <label className='label'>{t('background_opacity')}(%)</label>
          <NumberInput value={state.backgroundOpacity} onChange={handleChange('backgroundOpacity')} min={0} max={100} />
        </div>
        <div className='row'>
          <label className='label'>{t('allow_line_break')}</label>
          <Toggle
            variant='outline'
            aria-label={t('allow_line_break')}
            size='sm'
            pressed={state.lineBreak}
            onPressedChange={handleChange('lineBreak')}
          >
            <EqualsIcon className='size-5' />
          </Toggle>
        </div>
        <div className='row'>
          <label className='label'>{t('sync_adjustment')}(s)</label>
          <NumberInput value={state.delay} onChange={handleChange('delay')} step={0.1} />
        </div>
      </div>
    </section>
  );
}
