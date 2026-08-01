
import * as React from 'react';

import * as LabelPrimitive from '@radix-ui/react-label';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@utils/helper';
import { ChevronDownIcon } from 'lucide-react';
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  UseFormReturn,
} from 'react-hook-form';

import { Button } from '@/ui/components/button';
import { Label } from '@/ui/components/label';

export function Form<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  className,
  ...props
}: {
  form: UseFormReturn<TFieldValues>;
  onSubmit: (data: TFieldValues) => void;
} & Omit<React.ComponentProps<'form'>, 'onSubmit'>) {
  return (
    <FormProvider {...form}>
      <form
        {...props}
        className={cn('flex flex-col gap-2 px-4 py-3 border rounded-xl shadow bg-background', className)}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {props.children}
      </form>
    </FormProvider>
  );
}

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>({} as FormFieldContextValue);

export const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

export const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState } = useFormContext();
  const formState = useFormState({ name: fieldContext.name });
  const fieldState = getFieldState(fieldContext.name, formState);

  if (!fieldContext) {
    throw new Error('useFormField should be used within <FormField>');
  }

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>({} as FormItemContextValue);

export function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot='form-item' className={cn('flex items-center gap-1 min-h-8', className)} {...props} />
    </FormItemContext.Provider>
  );
}

export function FormLabel({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot='form-label'
      data-error={!!error}
      className={cn('data-[error=true]:text-destructive', className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

export function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      data-slot='form-control'
      id={formItemId}
      aria-describedby={!error ? `${formDescriptionId}` : `${formDescriptionId} ${formMessageId}`}
      aria-invalid={!!error}
      {...props}
    />
  );
}

export function FormDescription({ className, ...props }: React.ComponentProps<'p'>) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      data-slot='form-description'
      id={formDescriptionId}
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}

export function FormMessage({ className, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? '') : props.children;

  if (!body) {
    return null;
  }

  return (
    <p data-slot='form-message' id={formMessageId} className={cn('text-destructive text-[13px]', className)} {...props}>
      {body}
    </p>
  );
}

interface FormHeaderProps extends React.ComponentProps<'div'> {
  controlsId?: string;
  disclosureHidden?: boolean;
  disclosureLabel?: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function FormHeader({
  children,
  className,
  controlsId,
  disclosureHidden,
  disclosureLabel,
  expanded,
  onExpandedChange,
  ...props
}: FormHeaderProps) {
  const isCollapsible = typeof expanded === 'boolean';

  return (
    <div
      data-slot='form-header'
      className={cn('flex min-h-8 min-w-0 items-center gap-2', className)}
      {...props}
    >
      {children}
      {isCollapsible && !disclosureHidden && (
        <Button
          aria-controls={controlsId}
          aria-expanded={expanded}
          aria-label={disclosureLabel}
          className='shrink-0 text-muted-foreground'
          size='xxs'
          type='button'
          variant='ghost'
          onClick={() => onExpandedChange?.(!expanded)}
        >
          <ChevronDownIcon className={cn('transition-transform', expanded && 'rotate-180')} />
        </Button>
      )}
    </div>
  );
}

export function FormTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 data-slot='form-title' className={cn('min-w-0 flex-1 truncate text-[15px] font-bold', className)} {...props} />;
}

interface FormContentProps extends React.ComponentProps<'div'> {
  disabled?: boolean;
  expanded: boolean;
}

export function FormContent({ className, disabled, expanded, ...props }: FormContentProps) {
  return (
    <div
      data-slot='form-content'
      aria-disabled={disabled || undefined}
      className={cn(disabled && 'pointer-events-none opacity-50', className)}
      hidden={!expanded}
      role='region'
      {...props}
    />
  );
}
