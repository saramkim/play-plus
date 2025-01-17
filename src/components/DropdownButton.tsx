import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { getMessage } from '../utils/i18n';
import Dropdown, { Direction, DropdownOption } from './Dropdown';

interface DropdownButtonProps<V extends string> {
  options: DropdownOption<V>[];
  value: V;
  onChange: (value: V) => void;
  direction?: Direction;
}

const DropdownButton = <V extends string>({
  options,
  value,
  onChange,
  direction = 'bottomRight',
}: DropdownButtonProps<V>) => {
  return (
    <Dropdown direction={direction} options={options} value={value} onClick={(v) => v !== value && onChange(v)}>
      {({ isOpen, toggleDropdown }) => {
        const label = options.find((option) => option.value === value)?.label;
        return (
          <button
            onClick={toggleDropdown}
            className='w-24 h-7 px-2 flex justify-between items-center border rounded focus:outline-none focus:border-teal-500'
          >
            <span>{label || getMessage('select')}</span>
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
