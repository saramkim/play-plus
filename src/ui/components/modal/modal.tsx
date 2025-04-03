import { useEffect, useState } from 'react';

import { XMarkIcon } from '@heroicons/react/16/solid';

import { cn } from '@/ui/lib/utils';

import { modalService } from './modal-service';
import { Button } from '../button';

export function Modal() {
  const [content, setContent] = useState<React.ReactNode>(null);

  useEffect(() => {
    const unsubscribe = modalService.subscribe(setContent);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContent(null);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribe();
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return content ? (
    <div
      className={cn(
        'fixed inset-0 flex justify-center items-center bg-black/50 z-50',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0'
      )}
      data-state={content ? 'open' : 'closed'}
    >
      <div
        className={cn(
          'relative bg-background rounded-lg shadow-lg p-4 mx-4 w-full border duration-200 max-w-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
        )}
        onClick={(e) => e.stopPropagation()}
        data-state={content ? 'open' : 'closed'}
      >
        <div>{content}</div>
        <Button
          variant='ghost'
          size='xxs'
          className='absolute top-2 right-2 cursor-default'
          onClick={() => setContent(null)}
        >
          <XMarkIcon className='size-4' />
        </Button>
      </div>
    </div>
  ) : null;
}
