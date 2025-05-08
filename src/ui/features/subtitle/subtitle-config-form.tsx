import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';
import { WrapTextIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ColorPicker } from '@/ui/components/color-picker';
import { Form, FormControl, FormField, FormHeader, FormItem, FormLabel, FormTitle } from '@/ui/components/form/form';
import { SliderField } from '@/ui/components/form/slider-field';
import { NumberInput } from '@/ui/components/number-input';
import { Switch } from '@/ui/components/switch';
import { Toggle } from '@/ui/components/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/toggle-group';
import { useConfigForm } from '@/ui/hooks/use-config-form';
import { cn } from '@/ui/lib/utils';

type SubtitleConfigFormProps = typeof SETTINGS.SUBTITLES.PRIMARY | typeof SETTINGS.SUBTITLES.SECONDARY;

export function SubtitleConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: SubtitleConfigFormProps) {
  const { form, onSubmit } = useConfigForm(STORAGE_KEY);
  const { isDirty, isValid } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader>
        <FormTitle>{t(TITLE_MESSAGE_KEY)}</FormTitle>
        <div className='flex items-center gap-1'>
          {isDirty ? (
            <>
              <Button variant='outline' size='sm' type='button' onClick={() => form.reset()}>
                {t('cancel')}
              </Button>
              <Button size='sm' type='submit' disabled={!isValid}>
                {t('save')}
              </Button>
            </>
          ) : (
            <FormField
              control={form.control}
              name='enabled'
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={(v) => onSubmit({ ...form.getValues(), enabled: v })} />
              )}
            />
          )}
        </div>
      </FormHeader>
      <div className={cn('flex flex-col gap-1', form.watch('enabled') ? '' : 'opacity-50 pointer-events-none')}>
        <FormField
          control={form.control}
          name='language'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('language')}</FormLabel>
              <FormControl>
                <ToggleGroup
                  type='single'
                  variant='outline'
                  size='sm'
                  className='w-full'
                  onValueChange={(value) => {
                    if (value === 'en' || value === 'ko') {
                      field.onChange(value);
                    }
                  }}
                  value={field.value}
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
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='positionReference'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('position_reference')}</FormLabel>
              <FormControl>
                <ToggleGroup
                  type='single'
                  variant='outline'
                  size='sm'
                  className='w-full'
                  onValueChange={(value) => {
                    if (value === 'top' || value === 'center' || value === 'bottom') {
                      field.onChange(value);
                    }
                  }}
                  value={field.value}
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
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='positionOffset'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('position_offset')}(px)</FormLabel>
              <FormControl>
                <NumberInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='color'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subtitle_color')}</FormLabel>
              <FormControl>
                <ColorPicker {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='fontSize'
          render={({ field }) => <SliderField label={t('subtitle_size')} field={field} min={1} max={10} />}
        />
        <FormField
          control={form.control}
          name='fontWeight'
          render={({ field }) => <SliderField label={t('font_weight')} field={field} min={1} max={6} />}
        />
        <FormField
          control={form.control}
          name='backgroundOpacity'
          render={({ field }) => (
            <SliderField label={t('background_opacity')} field={field} min={0} max={100} unit='%' />
          )}
        />
        <FormField
          control={form.control}
          name='lineBreak'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('allow_line_break')}</FormLabel>
              <FormControl>
                <Toggle
                  variant='outline'
                  aria-label={t('allow_line_break')}
                  size='sm'
                  pressed={field.value}
                  onPressedChange={field.onChange}
                >
                  <WrapTextIcon className='size-5' />
                </Toggle>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='delay'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('sync_adjustment')}(s)</FormLabel>
              <FormControl>
                <NumberInput {...field} step={0.1} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
}
