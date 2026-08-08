import { useEffect, useId, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { learningProfileSchema } from '@storage/v2/schema';
import { V2SyncStorage } from '@storage/v2/type';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';
import { LoaderCircleIcon } from 'lucide-react';
import { useForm, UseFormReturn } from 'react-hook-form';

import { Button } from '@/ui/components/button';
import { Form, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';

import { LanguageSelectField } from './language-select-field';

export type LearningProfile = V2SyncStorage['learningProfile'];

interface LearningProfileFormProps {
  className?: string;
  settingsPresentation?: boolean;
  submitDisabled?: boolean;
  submitRequiresDirty?: boolean;
  description?: string;
  onSubmit: (value: LearningProfile, event?: React.BaseSyntheticEvent) => void | Promise<void>;
  submitLabel?: string;
  title?: string;
  value: LearningProfile;
}

export function LearningProfileForm({
  className,
  description,
  onSubmit,
  settingsPresentation = false,
  submitLabel = t('save'),
  title = t('learning_languages'),
  submitDisabled = false,
  submitRequiresDirty = false,
  value,
}: LearningProfileFormProps) {
  const [baseline, setBaseline] = useState(value);
  const [editing, setEditing] = useState(!settingsPresentation);
  const [submitError, setSubmitError] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const focusEditButtonRef = useRef(false);
  const focusFirstSelectRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const currentExternalValueRef = useRef(value);
  const lastExternalValueRef = useRef(value);
  const submittedValueRef = useRef<LearningProfile | null>(null);
  const titleId = useId();
  const form = useForm<LearningProfile>({
    defaultValues: value,
    mode: 'onChange',
    resolver: zodResolver(learningProfileSchema),
  });
  currentExternalValueRef.current = value;

  useEffect(() => {
    if (learningProfilesEqual(lastExternalValueRef.current, value)) return;
    lastExternalValueRef.current = value;
    const submittedValue = submittedValueRef.current;
    const preserveCurrentDraft = submittedValue !== null && learningProfilesEqual(submittedValue, value);
    if (preserveCurrentDraft) {
      resetLearningProfileBaseline(form, value);
    } else {
      form.reset(value);
    }
    setBaseline(value);
    submittedValueRef.current = null;
    setSubmitError(false);
  }, [form, value]);

  useEffect(() => {
    if (!submitDisabled) void form.trigger();
  }, [form, submitDisabled]);

  useEffect(() => {
    if (!settingsPresentation) return;

    if (editing && focusFirstSelectRef.current) {
      focusFirstSelectRef.current = false;
      formRef.current?.querySelector<HTMLSelectElement>('select')?.focus();
    }
    if (!editing && focusEditButtonRef.current) {
      focusEditButtonRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing, settingsPresentation]);

  const draft = form.watch();
  const isDirty = !learningProfilesEqual(draft, baseline);

  const handleSubmit = async (nextValue: LearningProfile, event?: React.BaseSyntheticEvent) => {
    if (submitRequiresDirty && !isDirty) return;

    if (!submitRequiresDirty) {
      await onSubmit(nextValue, event);
      return;
    }

    const externalValueAtSubmit = currentExternalValueRef.current;
    const submittedValue = structuredClone(nextValue);
    setSubmitError(false);
    submittedValueRef.current = submittedValue;
    try {
      await onSubmit(submittedValue, event);
      const currentExternalValue = currentExternalValueRef.current;
      const supersededByExternalValue =
        !learningProfilesEqual(currentExternalValue, externalValueAtSubmit) &&
        !learningProfilesEqual(currentExternalValue, submittedValue);
      if (supersededByExternalValue) return;

      const submittedDraftIsCurrent = learningProfilesEqual(form.getValues(), submittedValue);
      setBaseline(submittedValue);
      resetLearningProfileBaseline(form, submittedValue);
      if (settingsPresentation && submittedDraftIsCurrent) {
        focusEditButtonRef.current = true;
        setEditing(false);
      }
    } catch {
      const currentExternalValue = currentExternalValueRef.current;
      const supersededByExternalValue =
        !learningProfilesEqual(currentExternalValue, externalValueAtSubmit) &&
        !learningProfilesEqual(currentExternalValue, submittedValue);
      if (supersededByExternalValue) return;

      submittedValueRef.current = null;
      setSubmitError(true);
    }
  };

  const submitReady = !submitRequiresDirty || isDirty;
  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;
  const usePrimarySubmit = isSubmitting || (submitReady && isValid);

  const edit = () => {
    focusFirstSelectRef.current = true;
    setEditing(true);
  };

  const cancel = () => {
    if (isSubmitting) return;
    form.reset(baseline);
    setSubmitError(false);
    focusEditButtonRef.current = true;
    setEditing(false);
  };

  return (
    <Form
      aria-busy={(settingsPresentation && isSubmitting) || undefined}
      aria-labelledby={titleId}
      className={className}
      form={form}
      onSubmit={handleSubmit}
      ref={formRef}
    >
      <FormHeader>
        <div className='min-w-0 flex-1'>
          <FormTitle id={titleId}>{title}</FormTitle>
          {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
        </div>
        {settingsPresentation && !editing && (
          <Button
            className='h-7 shrink-0 px-2'
            ref={editButtonRef}
            size='sm'
            type='button'
            variant='ghost'
            onClick={edit}
          >
            {t('edit')}
          </Button>
        )}
      </FormHeader>
      {settingsPresentation && !editing ? (
        <dl className='flex flex-col gap-2 text-sm'>
          <LanguageSummary label={t('learning_language')} value={t(LANGUAGES[baseline.learningLanguage])} />
          <LanguageSummary
            label={t('support_language')}
            value={baseline.supportLanguage === null ? t('no_support_language') : t(LANGUAGES[baseline.supportLanguage])}
          />
        </dl>
      ) : (
        <div className='contents'>
          <FormField
            control={form.control}
            name='learningLanguage'
            render={({ field }) => <LanguageSelectField field={field} label={t('learning_language')} />}
          />
          <FormField
            control={form.control}
            name='supportLanguage'
            render={({ field }) => <LanguageSelectField field={field} label={t('support_language')} optional />}
          />
          {submitError && <p role='alert' className='text-wrap text-sm text-destructive'>{t('error_try_later')}</p>}
          {settingsPresentation ? (
            <div className='flex justify-end gap-2'>
              <Button disabled={isSubmitting} size='sm' type='button' variant='ghost' onClick={cancel}>
                {t('cancel')}
              </Button>
              <Button
                aria-busy={isSubmitting || undefined}
                className='min-w-24'
                disabled={submitDisabled || !submitReady || !isValid || isSubmitting}
                size='sm'
                type='submit'
                variant={usePrimarySubmit ? 'default' : 'outline'}
              >
                {isSubmitting && <LoaderCircleIcon className='animate-spin' />}
                {isSubmitting ? t('saving') : submitLabel}
              </Button>
            </div>
          ) : (
            <Button type='submit' disabled={submitDisabled || !isValid || isSubmitting}>
              {submitLabel}
            </Button>
          )}
        </div>
      )}
    </Form>
  );
}

function LanguageSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex min-w-0 items-baseline justify-between gap-3'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 text-wrap text-right font-medium'>{value}</dd>
    </div>
  );
}

const learningProfilesEqual = (left: LearningProfile, right: LearningProfile) =>
  left.learningLanguage === right.learningLanguage && left.supportLanguage === right.supportLanguage;

const resetLearningProfileBaseline = (form: UseFormReturn<LearningProfile>, baseline: LearningProfile) => {
  form.reset(baseline, { keepValues: true });
  void form.trigger();
};
