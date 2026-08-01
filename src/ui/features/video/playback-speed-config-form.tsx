import { useId, useState } from 'react';

import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Form, FormContent, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';
import { ShortcutField } from '@/ui/components/form/shortcut-field';
import { Switch } from '@/ui/components/switch';
import { useConfigForm } from '@/ui/hooks/use-config-form';

const { STORAGE_KEY } = SETTINGS.PLAYBACK_SPEED;

interface PlaybackSpeedConfigFormProps {
  defaultExpanded?: boolean;
}

export function PlaybackSpeedConfigForm({ defaultExpanded = false }: PlaybackSpeedConfigFormProps) {
  const { form, onSubmit } = useConfigForm(STORAGE_KEY);
  const { isDirty, isValid } = form.formState;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const id = useId();
  const contentId = `${id}-content`;
  const titleId = `${id}-title`;
  const enabled = form.watch('enabled');
  const title = t('playback_speed');

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
      </FormContent>
    </Form>
  );
}
