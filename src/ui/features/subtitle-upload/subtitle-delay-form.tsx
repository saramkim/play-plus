
import { useCallback, useEffect, useRef, useState } from 'react';

import { round } from '@utils/helper';
import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { NumberInput } from '@/ui/components/number-input';
import { useClickOutside } from '@/ui/hooks/use-click-outside';

interface SubtitleDelayFormProps {
  initialDelay?: number;
  onUpdateDelay: (delay: number) => void;
  closeEditMode: () => void;
}

export function SubtitleDelayForm({ initialDelay, onUpdateDelay, closeEditMode }: SubtitleDelayFormProps) {
  const [delay, setDelay] = useState(initialDelay ?? 0);
  const formRef = useRef<HTMLFormElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useClickOutside([formRef], closeEditMode);

  const stopStepping = useCallback(() => {
    if (delayTimeoutRef.current !== null) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('blur', stopStepping);
    return () => {
      window.removeEventListener('blur', stopStepping);
      stopStepping();
    };
  }, [stopStepping]);

  const startStepping = (step: number) => {
    stopStepping();
    setDelay((prev) => round(prev + step));

    delayTimeoutRef.current = setTimeout(() => {
      delayTimeoutRef.current = null;
      intervalRef.current = setInterval(() => {
        setDelay((prev) => round(prev + step));
      }, 50);
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    stopStepping();
    onUpdateDelay(delay);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className='flex items-center gap-2'>
      <Button
        variant='outline'
        size='sm'
        type='button'
        onMouseDown={() => startStepping(-0.1)}
        onMouseUp={stopStepping}
        onMouseLeave={stopStepping}
        onPointerCancel={stopStepping}
      >
        <MinusIcon />
      </Button>

      <NumberInput value={delay} onChange={setDelay} step={0.1} />

      <Button
        variant='outline'
        size='sm'
        type='button'
        onMouseDown={() => startStepping(0.1)}
        onMouseUp={stopStepping}
        onMouseLeave={stopStepping}
        onPointerCancel={stopStepping}
      >
        <PlusIcon />
      </Button>
      <Button variant='outline' size='sm' type='submit'>
        <CheckIcon />
      </Button>
    </form>
  );
}
