import { SETTINGS } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormControl, FormField, FormHeader, FormItem, FormLabel, FormTitle } from '@/ui/components/form/form';
import { ShortcutField } from '@/ui/components/form/shortcut-field';
import { NumberInput } from '@/ui/components/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';

type VideoSkipConfigFormProps = typeof SETTINGS.VIDEO_SKIP | typeof SETTINGS.SUB_VIDEO_SKIP;

export function VideoSkipConfigForm({ STORAGE_KEY, TITLE_MESSAGE_KEY }: VideoSkipConfigFormProps) {
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
          name='backward'
          render={({ field }) => <ShortcutField label={t('backward_key')} field={field} />}
        />
        <FormField
          control={form.control}
          name='forward'
          render={({ field }) => <ShortcutField label={t('forward_key')} field={field} />}
        />
        <div className='flex items-center gap-1'>
          <FormField
            control={form.control}
            name='skipTime'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('skip_unit')}</FormLabel>
                <FormControl>
                  <NumberInput {...field} min={1} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='skipTimeUnit'
            render={({ field }) => (
              <FormItem className='flex-1'>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
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
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        {form.watch('skipTimeUnit') === 'subtitles' && (
          <div className='flex items-center gap-1'>
            <FormField
              control={form.control}
              name='fallbackTime'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fallback_unit')}</FormLabel>
                  <FormControl>
                    <NumberInput {...field} min={1} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='fallbackUnit'
              render={({ field }) => (
                <FormItem className='flex-1'>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
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
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        )}
      </div>
    </Form>
  );
}
