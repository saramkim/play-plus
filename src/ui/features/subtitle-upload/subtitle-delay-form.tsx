
import { useCallback, useEffect, useRef, useState } from 'react';

import { round } from '@utils/helper';
import { t } from '@utils/i18n';
import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import { NumberInput } from '@/ui/components/number-input';
import { useClickOutside } from '@/ui/hooks/use-click-outside';

import { SubtitleDelayApplyError } from './update-subtitle-delay';

interface SubtitleDelayFormProps {
  initialDelay?: number;
  onUpdateDelay: (delay: number) => void | Promise<'stored' | 'applied'>;
  closeEditMode: () => void;
}

export function SubtitleDelayForm({ initialDelay, onUpdateDelay, closeEditMode }: SubtitleDelayFormProps) {
  const [delay, setDelay] = useState(initialDelay ?? 0);
  const formRef = useRef<HTMLFormElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRef = useRef(false);
  const mountedRef = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useClickOutside([formRef], () => { if (!pendingRef.current) closeEditMode(); });

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
    mountedRef.current = true;
    window.addEventListener('blur', stopStepping);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('blur', stopStepping);
      stopStepping();
    };
  }, [stopStepping]);

  const startStepping = (step: number) => {
    if (pendingRef.current) return;
    stopStepping();
    setDelay((prev) => round(prev + step));

    delayTimeoutRef.current = setTimeout(() => {
      delayTimeoutRef.current = null;
      intervalRef.current = setInterval(() => {
        setDelay((prev) => round(prev + step));
      }, 50);
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    stopStepping();
    try {
      const result = await onUpdateDelay(delay);
      if (!mountedRef.current) return;
      if (result === 'stored') toast.success(t('info_subtitle_delay_saved'));
      closeEditMode();
    } catch (error) {
      if (!mountedRef.current) return;
      setError(t(error instanceof SubtitleDelayApplyError ? 'error_subtitle_delay_apply' : 'error_try_later'));
    } finally {
      pendingRef.current = false;
      if (mountedRef.current) setPending(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
      <Button
        disabled={pending}
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

      <NumberInput disabled={pending} value={delay} onChange={(value) => { if (!pendingRef.current) setDelay(value); }} step={0.1} />

      <Button
        disabled={pending}
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
      <Button disabled={pending} variant='outline' size='sm' type='submit'>
        <CheckIcon />
      </Button>
      </div>
      {error && <p role='alert' className='whitespace-normal break-words'>{error}</p>}
    </form>
  );
}
