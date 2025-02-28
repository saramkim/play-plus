import { useState, useRef, useLayoutEffect } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

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

interface DropdownProps {
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  direction?: Direction;
  trigger: (props: { isOpen: boolean; toggleDropdown: () => void }) => React.ReactNode;
}

const Dropdown = ({ children, direction, trigger }: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [calculatedDirection, setCalculatedDirection] = useState<Direction>('bottomRight');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(containerRef, () => setIsOpen(false));

  const calculateDirection = () => {
    if (!isOpen || !containerRef.current || !dropdownRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const totalHeight = dropdownRef.current.offsetHeight;
    const totalWidth = dropdownRef.current.offsetWidth;

    const hasSpaceBelow = rect.bottom + totalHeight <= window.innerHeight;
    const hasSpaceAbove = rect.top - totalHeight >= 0;
    const hasSpaceRight = rect.left + totalWidth <= window.innerWidth;

    let newDirection: Direction = 'bottomRight';
    if (hasSpaceBelow) {
      newDirection = hasSpaceRight ? 'bottomRight' : 'bottomLeft';
    } else if (hasSpaceAbove) {
      newDirection = hasSpaceRight ? 'topRight' : 'topLeft';
    }

    setCalculatedDirection(newDirection);
  };

  useLayoutEffect(() => {
    calculateDirection();

    if (isOpen) {
      window.addEventListener('resize', calculateDirection);
      return () => window.removeEventListener('resize', calculateDirection);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className='relative flex'>
      {trigger({ isOpen, toggleDropdown: () => setIsOpen(!isOpen) })}

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute ${
            positionMap[direction || calculatedDirection]
          } bg-white border border-gray-200 rounded shadow-lg z-10 min-w-full overflow-auto`}
        >
          {typeof children === 'function' ? children(() => setIsOpen(false)) : children}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
