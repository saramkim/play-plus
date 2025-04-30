import { ControllerRenderProps } from 'react-hook-form';

import { FormControl, FormItem, FormLabel } from '@/ui/components/form';
import { Slider } from '@/ui/components/slider';

interface SliderFieldProps {
  label: string;
  field: ControllerRenderProps<any, any>;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export function SliderField({ label, field, min, max, step, unit }: SliderFieldProps) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Slider
          min={min}
          max={max}
          value={[field.value]}
          onValueChange={(value) => field.onChange(value[0])}
          step={step}
        />
      </FormControl>
      <div className='min-w-9 text-center'>{unit ? `${field.value}${unit}` : field.value}</div>
    </FormItem>
  );
}
