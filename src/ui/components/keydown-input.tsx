import { XMarkIcon } from '@heroicons/react/16/solid';
import { t } from '@utils/i18n';

import { Input } from './input';

interface KeydownInputProps {
  value: string;
  onChange: (value: string) => void;
}

export const KeydownInput = ({ value, onChange }: KeydownInputProps) => {
  return (
    <div className='relative w-full group'>
      <Input value={value} onKeyDown={({ code }) => code !== value && onChange(code)} readOnly />
      {value && (
        <button
          className='absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:block group-focus-within:block'
          onClick={() => onChange('')}
        >
          <XMarkIcon className='size-4 text-gray-500 hover:text-gray-700' />
        </button>
      )}
      <span
        className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hidden ${
          value ? '' : 'group-focus-within:block'
        }`}
      >
        {t('press_any_key')}
      </span>
    </div>
  );
};
