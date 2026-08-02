import { LANGUAGES, Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { ControllerRenderProps, FieldPath, FieldValues } from 'react-hook-form';

import { FormControl, FormItem, FormLabel } from '@/ui/components/form/form';

interface LanguageSelectFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  field: ControllerRenderProps<TFieldValues, TName>;
  label: string;
  optional?: boolean;
}

const LANGUAGE_OPTIONS = Object.entries(LANGUAGES) as [Language, (typeof LANGUAGES)[Language]][];

export function LanguageSelectField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({ field, label, optional = false }: LanguageSelectFieldProps<TFieldValues, TName>) {
  return (
    <FormItem className='flex-col items-stretch gap-1'>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <select
          {...field}
          className='border-input bg-background h-8 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50'
          value={(field.value as Language | null) ?? ''}
          onChange={(event) => field.onChange(event.target.value || null)}
        >
          {optional && <option value=''>{t('no_support_language')}</option>}
          {LANGUAGE_OPTIONS.map(([value, messageKey]) => (
            <option key={value} value={value}>
              {t(messageKey)}
            </option>
          ))}
        </select>
      </FormControl>
    </FormItem>
  );
}
