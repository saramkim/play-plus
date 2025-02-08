import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { t } from '../utils/i18n';
import Dropdown, { DropdownOption } from './Dropdown';

interface DropdownButtonProps<V extends string> {
  options: DropdownOption<V>[];
  value: V;
  onChange: (value: V) => void;
  visibleItemCount?: number;
}

const DropdownButton = <V extends string>({
  options,
  value,
  onChange,
  visibleItemCount = 5,
}: DropdownButtonProps<V>) => {
  return (
    <Dropdown
      options={options}
      value={value}
      onClick={(v) => v !== value && onChange(v)}
      visibleItemCount={visibleItemCount}
    >
      {({ isOpen, toggleDropdown }) => {
        const label = options.find((option) => option.value === value)?.label;
        return (
          <button
            type='button'
            onClick={toggleDropdown}
            className='min-w-24 w-full h-8 px-2 flex justify-between items-center border rounded focus:outline-none focus:border-teal-500'
          >
            <span>{label || t('select')}</span>
            <span className='text-gray-500'>
              {isOpen ? <ChevronUpIcon className='size-4' /> : <ChevronDownIcon className='size-4' />}
            </span>
          </button>
        );
      }}
    </Dropdown>
  );
};

export default DropdownButton;
