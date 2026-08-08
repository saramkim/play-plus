import { useEffect, useId, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { subtitleDisplaySchema } from '@storage/v2/schema';
import { V2SyncStorage } from '@storage/v2/type';
import { t } from '@utils/i18n';
import { LoaderCircleIcon, WrapTextIcon } from 'lucide-react';
import { FieldPath, useForm, UseFormReturn } from 'react-hook-form';

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

type SubtitleDisplay = V2SyncStorage['subtitleDisplay'];
type SubtitleRole = keyof SubtitleDisplay;

interface SubtitleDisplayFormProps {
  className?: string;
  learningProfile: V2SyncStorage['learningProfile'];
  onSubmit: (value: SubtitleDisplay, event?: React.BaseSyntheticEvent) => void | Promise<void>;
  value: SubtitleDisplay;
}

export function SubtitleDisplayForm({ className, learningProfile, onSubmit, value }: SubtitleDisplayFormProps) {
  const [baseline, setBaseline] = useState(value);
  const [submitError, setSubmitError] = useState(false);
  const currentExternalValueRef = useRef(value);
  const lastExternalValueRef = useRef(value);
  const submittedValueRef = useRef<SubtitleDisplay | null>(null);
  const titleId = useId();
  const form = useForm<SubtitleDisplay>({
    defaultValues: value,
    mode: 'onChange',
    resolver: zodResolver(subtitleDisplaySchema),
  });
  currentExternalValueRef.current = value;

  useEffect(() => {
    if (subtitleDisplaysEqual(lastExternalValueRef.current, value)) return;
    lastExternalValueRef.current = value;
    const submittedValue = submittedValueRef.current;
    const preserveCurrentDraft = submittedValue !== null && subtitleDisplaysEqual(submittedValue, value);
    if (preserveCurrentDraft) {
      resetSubtitleDisplayBaseline(form, value);
    } else {
      form.reset(value);
    }
    setBaseline(value);
    submittedValueRef.current = null;
    setSubmitError(false);
  }, [form, value]);

  useEffect(() => {
    void form.trigger();
  }, [form]);

  const draft = form.watch();
  const isDirty = !subtitleDisplaysEqual(draft, baseline);

  const handleSubmit = async (nextValue: SubtitleDisplay, event?: React.BaseSyntheticEvent) => {
    if (!isDirty) return;

    const externalValueAtSubmit = currentExternalValueRef.current;
    const submittedValue = structuredClone(nextValue);
    setSubmitError(false);
    submittedValueRef.current = submittedValue;
    try {
      await onSubmit(submittedValue, event);
      const currentExternalValue = currentExternalValueRef.current;
      const supersededByExternalValue =
        !subtitleDisplaysEqual(currentExternalValue, externalValueAtSubmit) &&
        !subtitleDisplaysEqual(currentExternalValue, submittedValue);
      if (supersededByExternalValue) return;

      setBaseline(submittedValue);
      resetSubtitleDisplayBaseline(form, submittedValue);
    } catch {
      const currentExternalValue = currentExternalValueRef.current;
      const supersededByExternalValue =
        !subtitleDisplaysEqual(currentExternalValue, externalValueAtSubmit) &&
        !subtitleDisplaysEqual(currentExternalValue, submittedValue);
      if (supersededByExternalValue) return;

      submittedValueRef.current = null;
      setSubmitError(true);
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  return (
    <Form
      aria-busy={isSubmitting || undefined}
      aria-labelledby={titleId}
      className={className}
      form={form}
      onSubmit={handleSubmit}
    >
      <FormHeader>
        <FormTitle id={titleId}>{t('subtitle_display')}</FormTitle>
      </FormHeader>
      <RoleDisplayFields form={form} role='learning' />
      <RoleDisplayFields form={form} role='support' disabled={learningProfile.supportLanguage === null} />
      {submitError && <p role='alert' className='text-wrap text-sm text-destructive'>{t('error_try_later')}</p>}
      <Button
        aria-busy={isSubmitting || undefined}
        className='min-w-24 self-end'
        disabled={!isDirty || !isValid || isSubmitting}
        size='sm'
        type='submit'
        variant={isSubmitting || (isDirty && isValid) ? 'default' : 'outline'}
      >
        {isSubmitting && <LoaderCircleIcon className='animate-spin' />}
        {isSubmitting ? t('saving') : t('save')}
      </Button>
    </Form>
  );
}

const subtitleDisplaysEqual = (left: SubtitleDisplay, right: SubtitleDisplay) =>
  JSON.stringify(left) === JSON.stringify(right);

const resetSubtitleDisplayBaseline = (form: UseFormReturn<SubtitleDisplay>, baseline: SubtitleDisplay) => {
  form.reset(baseline, { keepValues: true });
  void form.trigger();
};

interface RoleDisplayFieldsProps {
  disabled?: boolean;
  form: UseFormReturn<SubtitleDisplay>;
  role: SubtitleRole;
}

function RoleDisplayFields({ disabled = false, form, role }: RoleDisplayFieldsProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const contentId = `${id}-appearance`;
  const title = t(role === 'learning' ? 'learning_subtitle' : 'support_subtitle');
  const visibilityName = `${role}.visibility` as FieldPath<SubtitleDisplay>;
  const appearanceName = <K extends keyof SubtitleDisplay['learning']['appearance']>(key: K) =>
    `${role}.appearance.${key}` as FieldPath<SubtitleDisplay>;

  return (
    <fieldset
      aria-disabled={disabled || undefined}
      className='flex flex-col gap-1 rounded-lg border p-3 disabled:opacity-50'
      data-subtitle-role={role}
      disabled={disabled}
    >
      <FormHeader
        controlsId={contentId}
        disclosureLabel={t(expanded ? 'collapse_setting' : 'expand_setting', title)}
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        <FormTitle>{title}</FormTitle>
        <FormField
          control={form.control}
          name={visibilityName}
          render={({ field }) => (
            <Switch
              aria-label={t(role === 'learning' ? 'show_learning_subtitle' : 'show_support_subtitle')}
              checked={field.value === 'visible'}
              disabled={disabled}
              onCheckedChange={(checked) => field.onChange(checked ? 'visible' : 'hidden')}
            />
          )}
        />
      </FormHeader>
      <FormContent id={contentId} aria-label={title} disabled={disabled} expanded={expanded}>
        <FormField
          control={form.control}
          name={appearanceName('positionReference')}
          render={({ field }) => (
            <ToggleGroupField
              field={field}
              label={t('position_reference')}
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
          name={appearanceName('positionOffset')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('position_offset')}(px)</FormLabel>
              <FormControl>
                <NumberInput {...field} value={field.value as number} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={appearanceName('color')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subtitle_color')}</FormLabel>
              <FormControl>
                <ColorPicker {...field} value={field.value as string} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={appearanceName('fontSize')}
          render={({ field }) => <SliderField field={field} label={t('subtitle_size')} max={10} min={1} />}
        />
        <FormField
          control={form.control}
          name={appearanceName('fontWeight')}
          render={({ field }) => <SliderField field={field} label={t('font_weight')} max={6} min={1} />}
        />
        <FormField
          control={form.control}
          name={appearanceName('backgroundOpacity')}
          render={({ field }) => (
            <SliderField field={field} label={t('background_opacity')} max={100} min={0} unit='%' />
          )}
        />
        <FormField
          control={form.control}
          name={appearanceName('lineBreak')}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('allow_line_break')}</FormLabel>
              <FormControl>
                <Toggle
                  aria-label={t('allow_line_break')}
                  pressed={field.value as boolean}
                  size='sm'
                  variant='outline'
                  onPressedChange={field.onChange}
                >
                  <WrapTextIcon className='size-5' />
                </Toggle>
              </FormControl>
            </FormItem>
          )}
        />
      </FormContent>
    </fieldset>
  );
}
