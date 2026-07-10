import { SETTINGS } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';
import { ShortcutField } from '@/ui/components/form/shortcut-field';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';

const { STORAGE_KEY } = SETTINGS.SHORTCUTS;

export function ShortcutsConfigForm() {
  const { form, onSubmit } = useConfigForm(STORAGE_KEY);
  const { isDirty, isValid } = form.formState;

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader>
        <FormTitle>{t('shortcuts')}</FormTitle>
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
          name='savePrimary'
          render={({ field }) => <ShortcutField label={t('save_primary_subtitle')} field={field} />}
        />
        <FormField
          control={form.control}
          name='saveSecondary'
          render={({ field }) => <ShortcutField label={t('save_secondary_subtitle')} field={field} />}
        />
        <FormField
          control={form.control}
          name='copyPrimary'
          render={({ field }) => <ShortcutField label={t('copy_primary_subtitle')} field={field} />}
        />
        <FormField
          control={form.control}
          name='copySecondary'
          render={({ field }) => <ShortcutField label={t('copy_secondary_subtitle')} field={field} />}
        />
        <FormField
          control={form.control}
          name='togglePrimary'
          render={({ field }) => <ShortcutField label={t('toggle_primary_subtitle')} field={field} />}
        />
        <FormField
          control={form.control}
          name='toggleSecondary'
          render={({ field }) => <ShortcutField label={t('toggle_secondary_subtitle')} field={field} />}
        />
      </div>
    </Form>
  );
}
