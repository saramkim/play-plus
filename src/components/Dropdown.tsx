import { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

export type Direction = 'bottomRight' | 'bottomLeft' | 'topRight' | 'topLeft';

export interface DropdownOption<V> {
  value: V;
  label: string;
}

const positionMap: Record<Direction, string> = {
  topRight: 'bottom-full left-0 mb-1',
  topLeft: 'bottom-full right-0 mb-1',
  bottomRight: 'top-full left-0 mt-1',
  bottomLeft: 'top-full right-0 mt-1',
};

interface DropdownProps<V extends string> {
  options: DropdownOption<V>[];
  value?: V;
  onClick: (value: V) => void;
  direction: Direction;
  children: (props: { isOpen: boolean; toggleDropdown: () => void }) => React.ReactNode;
}

const Dropdown = <V extends string>({ options, value, onClick, direction, children }: DropdownProps<V>) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const handleClick = (v: V) => {
    setIsOpen(false);
    onClick(v);
  };

  return (
    <div ref={containerRef} className='relative inline-block'>
      {children({ isOpen, toggleDropdown: () => setIsOpen(!isOpen) })}

      {isOpen && (
        <div className={`absolute ${positionMap[direction]} bg-white border rounded shadow-lg z-10 min-w-full`}>
          {options.map((option) => (
            <button
              key={option.value}
              className={`flex items-center px-2 h-8 w-full focus:outline-none ${
                option.value === value ? 'bg-gray-200' : 'hover:bg-gray-100'
              }`}
              onClick={() => handleClick(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
