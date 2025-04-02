import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormControl, FormField, FormHeader, FormItem, FormLabel, FormTitle } from '@/ui/components/form';
import { KeydownInput } from '@/ui/components/keydown-input';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';
import { cn } from '@/ui/lib/utils';

const { STORAGE_KEY } = SETTINGS.SHORTCUTS;

export function ShortcutsConfigForm() {
  const { form, loading, onSubmit } = useConfigForm(STORAGE_KEY);
  const { isDirty, isValid } = form.formState;

  if (loading) return null;

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
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          )}
        </div>
      </FormHeader>
      <div className={cn('flex flex-col gap-1', form.watch('enabled') ? '' : 'opacity-50 pointer-events-none')}>
        <FormField
          control={form.control}
          name='savePrimary'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('save_primary_subtitle')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='saveSecondary'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('save_secondary_subtitle')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='togglePrimary'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('toggle_primary_subtitle')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='toggleSecondary'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('toggle_secondary_subtitle')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Form>
  );
}
