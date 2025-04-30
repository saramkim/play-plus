import { cn } from '@/ui/lib/utils';

interface ColorPickerProps extends Omit<React.ComponentProps<'input'>, 'value' | 'type'> {
  value: string;
}

export function ColorPicker({ value, className, ...props }: ColorPickerProps) {
  return (
    <div className='relative inline-block size-8'>
      <input type='color' value={value} className='absolute inset-0 size-full opacity-0 cursor-pointer' {...props} />
      <div className={cn('size-full rounded-full border', className)} style={{ backgroundColor: value }} />
    </div>
  );
}
