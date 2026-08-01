import { useId, useState } from 'react';

import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormContent, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';
import { ShortcutField } from '@/ui/components/form/shortcut-field';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';

interface LoopConfigFormProps {
  defaultExpanded?: boolean;
}

export function LoopConfigForm({ defaultExpanded = false }: LoopConfigFormProps) {
  const { form, onSubmit } = useConfigForm('loop');
  const { isDirty, isValid } = form.formState;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const id = useId();
  const contentId = `${id}-content`;
  const titleId = `${id}-title`;
  const enabled = form.watch('enabled');
  const title = t('loop');

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader
        controlsId={contentId}
        disclosureHidden={isDirty}
        disclosureLabel={t(expanded ? 'collapse_setting' : 'expand_setting', title)}
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        <FormTitle id={titleId}>{title}</FormTitle>
        <div className='flex shrink-0 items-center gap-1'>
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
                <Switch
                  aria-label={title}
                  checked={field.value}
                  onCheckedChange={(v) => onSubmit({ ...form.getValues(), enabled: v })}
                />
              )}
            />
          )}
        </div>
      </FormHeader>
      <FormContent
        id={contentId}
        aria-labelledby={titleId}
        className='flex flex-col gap-1'
        disabled={!enabled}
        expanded={expanded}
      >
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
      </FormContent>
    </Form>
  );
}
