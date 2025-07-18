import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { XIcon } from 'lucide-react';


import { Input } from './input';

interface KeydownInputProps
  extends Omit<React.ComponentProps<'input'>, 'onChange' | 'readonly' | 'onKeyDown' | 'placeholder'> {
  onChange: (value: string) => void;
}

export const KeydownInput = ({ value, onChange, className, ...props }: KeydownInputProps) => {
  return (
    <div className='relative w-full group'>
      <Input
        value={value}
        onKeyDown={({ code }) => code !== value && onChange(code)}
        readOnly
        placeholder={t('press_any_key')}
        className={cn('placeholder:opacity-0 group-focus-within:placeholder:opacity-100', className)}
        {...props}
      />
      {value && (
        <button
          className='absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:block group-focus-within:block cursor-default'
          onClick={() => onChange('')}
        >
          <XIcon className='size-4 text-gray-500 hover:text-gray-700' />
        </button>
      )}
    </div>
  );
};
