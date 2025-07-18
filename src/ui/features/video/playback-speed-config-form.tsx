import { SETTINGS } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';
import { ShortcutField } from '@/ui/components/form/shortcut-field';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';

const { STORAGE_KEY } = SETTINGS.PLAYBACK_SPEED;

export function PlaybackSpeedConfigForm() {
  const { form, onSubmit } = useConfigForm(STORAGE_KEY);
  const { isDirty, isValid } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader>
        <FormTitle>{t('playback_speed')}</FormTitle>
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
      <div className={cn('flex flex-col gap-1', !form.getValues().enabled && 'opacity-50 pointer-events-none')}>
        <FormField
          control={form.control}
          name='increase'
          render={({ field }) => <ShortcutField label={t('increase_speed')} field={field} />}
        />
        <FormField
          control={form.control}
          name='decrease'
          render={({ field }) => <ShortcutField label={t('decrease_speed')} field={field} />}
        />
        <FormField
          control={form.control}
          name='reset'
          render={({ field }) => <ShortcutField label={t('reset_speed')} field={field} />}
        />
      </div>
    </Form>
  );
}
