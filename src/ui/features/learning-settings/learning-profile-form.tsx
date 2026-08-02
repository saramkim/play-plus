import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { learningProfileSchema } from '@storage/v2/schema';
import { V2SyncStorage } from '@storage/v2/type';
import { t } from '@utils/i18n';
import { useForm } from 'react-hook-form';

import { Button } from '@/ui/components/button';
import { Form, FormField, FormHeader, FormTitle } from '@/ui/components/form/form';

import { LanguageSelectField } from './language-select-field';

export type LearningProfile = V2SyncStorage['learningProfile'];

interface LearningProfileFormProps {
  description?: string;
  onSubmit: (value: LearningProfile) => void | Promise<void>;
  submitLabel?: string;
  title?: string;
  value: LearningProfile;
}

export function LearningProfileForm({
  description,
  onSubmit,
  submitLabel = t('save'),
  title = t('learning_languages'),
  value,
}: LearningProfileFormProps) {
  const form = useForm<LearningProfile>({
    defaultValues: value,
    mode: 'onChange',
    resolver: zodResolver(learningProfileSchema),
  });

  useEffect(() => form.reset(value), [form, value]);

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader>
        <div className='min-w-0 flex-1'>
          <FormTitle>{title}</FormTitle>
          {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
        </div>
      </FormHeader>
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
      <Button type='submit' disabled={!form.formState.isValid || form.formState.isSubmitting}>
        {submitLabel}
      </Button>
    </Form>
  );
}
