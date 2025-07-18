import { cn } from '@utils/helper';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';
import { ShortcutField } from '@/ui/components/form/shortcut-field';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';

export function LoopConfigForm() {
  const { form, onSubmit } = useConfigForm('loop');
  const { isDirty, isValid } = form.formState;

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
          name='toggleLoop'
          render={({ field }) => <ShortcutField label={t('toggle_loop_key')} field={field} />}
        />
        <FormField
          control={form.control}
          name='startPoint'
          render={({ field }) => <ShortcutField label={t('start_point_key')} field={field} />}
        />
        <FormField
          control={form.control}
          name='endPoint'
          render={({ field }) => <ShortcutField label={t('end_point_key')} field={field} />}
        />
        <FormField
          control={form.control}
          name='loopCurrentSubtitle'
          render={({ field }) => <ShortcutField label={t('loop_current_subtitle')} field={field} />}
        />
        <FormField
          control={form.control}
          name='playCurrentSubtitleOnce'
          render={({ field }) => <ShortcutField label={t('play_current_subtitle_once')} field={field} />}
        />
      </div>
    </Form>
  );
}
