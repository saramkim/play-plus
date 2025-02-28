import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { t } from '@utils/i18n';
import DropdownMenu, { DropdownOption } from './DropdownMenu';

interface DropdownSelectProps<V extends string> {
  options: DropdownOption<V>[];
  value: V;
  onChange: (value: V) => void;
  visibleItemCount?: number;
}

const DropdownSelect = <V extends string>({
  options,
  value,
  onChange,
  visibleItemCount = 5,
}: DropdownSelectProps<V>) => {
  return (
    <DropdownMenu
      options={options}
      value={value}
      onClick={(v) => v !== value && onChange(v)}
      visibleItemCount={visibleItemCount}
      trigger={({ isOpen, toggleDropdown }) => {
        const label = options.find((option) => option.value === value)?.label;
        return (
          <button
            type='button'
            onClick={toggleDropdown}
            className='min-w-24 w-full h-8 px-2 flex justify-between items-center border border-gray-200 rounded-sm focus:outline-hidden focus:border-teal-500'
          >
            <span>{label || t('select')}</span>
            <span className='text-gray-500'>
              {isOpen ? <ChevronUpIcon className='size-4' /> : <ChevronDownIcon className='size-4' />}
            </span>
          </button>
        );
      }}
    />
  );
};

export default DropdownSelect;
