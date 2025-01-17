import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/16/solid';
import { getMessage } from '../utils/i18n';
import { useEffect, useRef, useState } from 'react';

type Option<V extends string> = { label: string; value: V };

interface DropdownProps<V extends string> {
  options: Option<V>[];
  value: V;
  onChange: (value: V) => void;
}

function Dropdown<V extends string>({ options, value, onChange }: DropdownProps<V>) {
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const label = options.find((option) => option.value === value)?.label;

  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [isOpen]);

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node;
    if (isOpen && !container.current?.contains(target)) {
      setIsOpen(false);
    }
  };

  const handleOptionClick = (option: Option<V>) => {
    if (option.value !== value) onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div ref={container} className='relative inline-block w-full'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-full h-7 px-2 flex justify-between items-center border rounded focus:outline-none focus:border-teal-500'
      >
        <span>{label || getMessage('select')}</span>
        <span className='text-gray-500'>
          {isOpen ? <ChevronUpIcon className='size-4' /> : <ChevronDownIcon className='size-4' />}
        </span>
      </button>

      {isOpen && (
        <ul className='absolute bg-white mt-1 w-full border rounded shadow-lg z-10 overflow-hidden'>
          {options.map((option) => (
            <li
              key={option.value}
              onClick={() => handleOptionClick(option)}
              className={`h-7 px-2 flex items-center cursor-pointer ${
                option.value === value ? 'bg-teal-500 text-white' : 'hover:bg-teal-100'
              }`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Dropdown;
