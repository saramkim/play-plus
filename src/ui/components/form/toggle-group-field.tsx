import { ControllerRenderProps } from 'react-hook-form';

import { FormControl, FormItem, FormLabel } from '@/ui/components/form/form';
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/toggle-group';

interface ToggleGroupOption {
  label: string;
  value: string;
}

interface ToggleGroupFieldProps {
  field: ControllerRenderProps<any, any>;
  label: string;
  options: ToggleGroupOption[];
}

export function ToggleGroupField({ field, label, options }: ToggleGroupFieldProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          className='w-full'
          onValueChange={(value) => {
            if (value) field.onChange(value);
          }}
          {...field}
        >
          {options.map(({ label, value }) => (
            <ToggleGroupItem key={value} value={value} aria-label={label}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FormControl>
    </FormItem>
  );
}
