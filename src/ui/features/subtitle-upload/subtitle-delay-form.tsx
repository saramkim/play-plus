
import { useEffect, useRef, useState } from 'react';

import { round } from '@utils/helper';
import { t } from '@utils/i18n';
import { CheckIcon, MinusIcon, PlusIcon, XIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { NumberInput } from '@/ui/components/number-input';

interface SubtitleDelayFormProps {
  initialDelay?: number;
  onUpdateDelay: (delay: number) => Promise<void>;
  closeEditMode: () => void;
}

export function SubtitleDelayForm({ initialDelay, onUpdateDelay, closeEditMode }: SubtitleDelayFormProps) {
  const [delay, setDelay] = useState(initialDelay ?? 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startStepping = (step: number) => {
    setDelay((prev) => round(prev + step));

    delayTimeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDelay((prev) => round(prev + step));
      }, 50);
    }, 300);
  };

  const stopStepping = () => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => stopStepping, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await onUpdateDelay(delay);
    } catch (error) {
      console.error('Failed to update registered subtitle delay:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='flex min-w-0 flex-col gap-2'>
      <div className='grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2'>
        <StepButton step={-0.1} label={t('decrease_sync')} startStepping={startStepping} stopStepping={stopStepping}>
          <MinusIcon />
        </StepButton>
        <NumberInput aria-label={t('sync_adjustment')} value={delay} onChange={setDelay} step={0.1} />
        <StepButton step={0.1} label={t('increase_sync')} startStepping={startStepping} stopStepping={stopStepping}>
          <PlusIcon />
        </StepButton>
      </div>
      <div className='grid grid-cols-2 gap-2'>
        <Button variant='outline' size='sm' type='button' onClick={closeEditMode}>
          <XIcon />
          {t('cancel')}
        </Button>
        <Button size='sm' type='submit'>
          <CheckIcon />
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

interface StepButtonProps {
  step: number;
  label: string;
  startStepping: (step: number) => void;
  stopStepping: () => void;
  children: React.ReactNode;
}

function StepButton({ step, label, startStepping, stopStepping, children }: StepButtonProps) {
  return (
    <Button
      variant='outline'
      size='icon'
      type='button'
      aria-label={label}
      onPointerDown={() => startStepping(step)}
      onPointerUp={stopStepping}
      onPointerLeave={stopStepping}
      onPointerCancel={stopStepping}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        startStepping(step);
        stopStepping();
      }}
    >
      {children}
    </Button>
  );
}
