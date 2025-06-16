import { useState, useRef, useEffect } from 'react';

import { Minimize2Icon, SlidersVerticalIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';

import { cn } from '@/ui/lib/utils';

const BUTTON_SIZE = 40;

export function Controller() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - BUTTON_SIZE * 2, y: BUTTON_SIZE });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const controllerRef = useRef<HTMLDivElement>(null);

  const buttonList = [
    { Icon: SkipBackIcon, onClick: () => {} },
    { Icon: SkipForwardIcon, onClick: () => {} },
  ];

  const handleExpand = () => {
    const expandedWidth = buttonList.length * BUTTON_SIZE;

    setPosition((prev) => ({
      ...prev,
      x: isExpanded ? prev.x + expandedWidth : prev.x - expandedWidth,
    }));
    setIsExpanded((prev) => !prev);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = controllerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !controllerRef.current) return;

    const rect = controllerRef.current.getBoundingClientRect();

    const newX = e.clientX - dragStartPos.current.x;
    const newY = e.clientY - dragStartPos.current.y;

    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;

    setPosition({
      x: Math.min(Math.max(0, newX), maxX),
      y: Math.min(Math.max(0, newY), maxY),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    const handleResize = () => {
      if (!controllerRef.current) return;
      const rect = controllerRef.current.getBoundingClientRect();

      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      setPosition((prev) => ({
        x: Math.min(Math.max(0, prev.x), maxX),
        y: Math.min(Math.max(0, prev.y), maxY),
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={controllerRef}
      className='absolute top-0 left-0 shadow-lg rounded-lg z-[9999] select-none overflow-hidden pointer-events-auto'
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        willChange: 'transform',
      }}
    >
      <div className='bg-neutral-800 flex items-center' onMouseDown={handleMouseDown}>
        {isExpanded && (
          <div className='flex items-center'>
            {buttonList.map((button) => (
              <IconButton key={button.Icon.name} Icon={button.Icon} onClick={button.onClick} />
            ))}
          </div>
        )}

        <div className='flex items-center'>
          <IconButton Icon={isExpanded ? Minimize2Icon : SlidersVerticalIcon} onClick={handleExpand} />
        </div>
      </div>
    </div>
  );
}

function IconButton({ Icon, className, ...props }: { Icon: React.ElementType } & React.ComponentProps<'button'>) {
  return (
    <button
      className={cn(
        'text-neutral-300 hover:text-neutral-100 cursor-pointer flex items-center justify-center',
        className
      )}
      style={{ width: BUTTON_SIZE, height: BUTTON_SIZE }}
      {...props}
    >
      <Icon className='size-5' />
    </button>
  );
}
