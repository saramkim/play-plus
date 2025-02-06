import { useState, useRef } from 'react';
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
  visibleItemCount?: number;
  direction?: Direction;
  children: (props: { isOpen: boolean; toggleDropdown: () => void }) => React.ReactNode;
}

const ITEM_HEIGHT = 32;

const Dropdown = <V extends string>({
  options,
  value,
  onClick,
  visibleItemCount,
  direction,
  children,
}: DropdownProps<V>) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const handleClick = (v: V) => {
    setIsOpen(false);
    onClick(v);
  };

  const autoDirection = (options: DropdownOption<V>[]) => {
    if (!containerRef.current) return 'bottomRight';

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      const rect = containerRef.current.getBoundingClientRect();
      const totalHeight = Math.min(options.length, visibleItemCount || 100) * ITEM_HEIGHT + 6;

      context.font = window.getComputedStyle(containerRef.current).font;
      const totalWidth = Math.max(...options.map(({ label }) => context.measureText(label).width)) + 16;

      const hasSpaceBelow = rect.bottom + totalHeight <= window.innerHeight;
      const hasSpaceAbove = rect.top - totalHeight >= 0;
      const hasSpaceRight = rect.left + totalWidth <= window.innerWidth;

      if (hasSpaceBelow) {
        return hasSpaceRight ? 'bottomRight' : 'bottomLeft';
      }
      if (hasSpaceAbove) {
        return hasSpaceRight ? 'topRight' : 'topLeft';
      }
    }
    return 'bottomRight';
  };

  return (
    <div ref={containerRef} className='relative inline-block'>
      {children({ isOpen, toggleDropdown: () => setIsOpen(!isOpen) })}

      {isOpen && (
        <div
          className={`absolute ${
            positionMap[direction || autoDirection(options)]
          } bg-white border rounded shadow-lg z-10 min-w-full overflow-auto`}
          style={{ maxHeight: visibleItemCount ? visibleItemCount * ITEM_HEIGHT + 2 : undefined }}
        >
          {options.map((option) => (
            <button
              key={option.value}
              style={{ height: ITEM_HEIGHT }}
              className={`flex items-center px-2 w-full focus:outline-none ${
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
