import { useId, useState } from 'react';

import { SETTINGS } from '@utils/constants';
import { t } from '@utils/i18n';
import { WrapTextIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { ColorPicker } from '@/ui/components/color-picker';
import {
  Form,
  FormContent,
  FormControl,
  FormField,
  FormHeader,
  FormItem,
  FormLabel,
  FormTitle,
} from '@/ui/components/form/form';
import { SliderField } from '@/ui/components/form/slider-field';
import { ToggleGroupField } from '@/ui/components/form/toggle-group-field';
import { NumberInput } from '@/ui/components/number-input';
import { Switch } from '@/ui/components/switch';
import { Toggle } from '@/ui/components/toggle';
import { useConfigForm } from '@/ui/hooks/use-config-form';

type SubtitleConfigFormProps = (typeof SETTINGS.SUBTITLES.PRIMARY | typeof SETTINGS.SUBTITLES.SECONDARY) & {
  defaultExpanded?: boolean;
};

export function SubtitleConfigForm({ defaultExpanded = false, STORAGE_KEY, TITLE_MESSAGE_KEY }: SubtitleConfigFormProps) {
  const { form, onSubmit } = useConfigForm(STORAGE_KEY);
  const { isDirty, isValid } = form.formState;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const id = useId();
  const contentId = `${id}-content`;
  const titleId = `${id}-title`;
  const enabled = form.watch('enabled');
  const title = t(TITLE_MESSAGE_KEY);

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
          name='language'
          render={({ field }) => (
            <ToggleGroupField
              label={t('language')}
              field={field}
              options={[
                { label: t('english'), value: 'en' },
                { label: t('korean'), value: 'ko' },
              ]}
            />
          )}
        />
        <FormField
          control={form.control}
          name='positionReference'
          render={({ field }) => (
            <ToggleGroupField
              label={t('position_reference')}
              field={field}
              options={[
                { label: t('top'), value: 'top' },
                { label: t('center'), value: 'center' },
                { label: t('bottom'), value: 'bottom' },
              ]}
            />
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
      </FormContent>
    </Form>
  );
}
