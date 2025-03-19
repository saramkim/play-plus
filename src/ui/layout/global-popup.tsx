import { useEffect } from 'react';

import { XMarkIcon as XMarkIconSolid } from '@heroicons/react/16/solid';

import { usePopup } from '@/ui/contexts/popup-context';
import { cn } from '@/ui/lib/utils';

export function GlobalPopup() {
  const { popup, hidePopup, isOpen } = usePopup();

  if (!isOpen || !popup) return null;

  const { title, content } = popup;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hidePopup();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 flex justify-center items-center bg-black/50 z-50',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
      )}
      data-state={isOpen ? 'open' : 'closed'}
    >
      <div
        className={cn(
          'relative bg-background rounded-lg shadow-lg p-4 mx-4 w-full border duration-200 max-w-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
        )}
        onClick={(e) => e.stopPropagation()}
        data-state={isOpen ? 'open' : 'closed'}
      >
        <div className='flex flex-col gap-2'>
          <h2 className='text-[15px] font-bold'>{title}</h2>
          <div>{content}</div>
        </div>

        <button className='absolute top-2 right-2 icon-button cursor-default' onClick={hidePopup}>
          <XMarkIconSolid className='size-4' />
        </button>
      </div>
    </div>
  );
}
