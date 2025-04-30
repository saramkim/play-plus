import { ControllerRenderProps } from 'react-hook-form';

import { FormControl, FormItem, FormLabel, FormMessage } from '@/ui/components/form';
import { KeydownInput } from '@/ui/components/keydown-input';

interface ShortcutFieldProps {
  label: string;
  field: ControllerRenderProps<any, any>;
}

export const ShortcutField = ({ label, field }: ShortcutFieldProps) => {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div>
        <FormControl>
          <KeydownInput {...field} />
        </FormControl>
        <FormMessage />
      </div>
    </FormItem>
  );
};
