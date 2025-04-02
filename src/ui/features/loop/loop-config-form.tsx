import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormControl, FormField, FormHeader, FormItem, FormLabel, FormTitle } from '@/ui/components/form';
import { KeydownInput } from '@/ui/components/keydown-input';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';
import { cn } from '@/ui/lib/utils';

export function LoopConfigForm() {
  const { form, loading, onSubmit } = useConfigForm('loop');
  const { isDirty, isValid } = form.formState;

  if (loading) return null;

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader>
        <FormTitle>{t('loop')}</FormTitle>
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
          name='toggleLoop'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('toggle_loop_key')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='startPoint'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('start_point_key')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='endPoint'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('end_point_key')}</FormLabel>
              <FormControl>
                <KeydownInput {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='loopCurrentSubtitle'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('loop_current_subtitle')}</FormLabel>
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
