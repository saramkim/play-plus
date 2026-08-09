
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { round } from '@utils/helper';
import { t } from '@utils/i18n';
import { CheckIcon, MinusIcon, PlusIcon, XIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { NumberInput } from '@/ui/components/number-input';

import { RegisteredSubtitleRefreshError } from './subtitle-mutation-error';

interface SubtitleDelayFormProps {
  initialDelay?: number;
  onUpdateDelay: (delay: number) => Promise<void>;
  closeEditMode: () => void;
}

export function SubtitleDelayForm({ initialDelay, onUpdateDelay, closeEditMode }: SubtitleDelayFormProps) {
  const [delay, setDelay] = useState(initialDelay ?? 0);
  const [error, setError] = useState<string>();
  const [focusSaveRequest, setFocusSaveRequest] = useState(0);
  const [pending, setPending] = useState(false);
  const errorId = useId();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const delayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handledFocusSaveRequestRef = useRef(0);
  const pendingRef = useRef(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const startStepping = (step: number) => {
    setError(undefined);
    setDelay((prev) => round(prev + step));

    delayTimeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        setDelay((prev) => round(prev + step));
      }, 50);
    }, 300);
  };

  const stopStepping = useCallback(() => {
    if (delayTimeoutRef.current) {
      clearTimeout(delayTimeoutRef.current);
      delayTimeoutRef.current = null;
    }

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => stopStepping, [stopStepping]);

  useEffect(() => {
    if (pending || focusSaveRequest === handledFocusSaveRequestRef.current) return;
    handledFocusSaveRequestRef.current = focusSaveRequest;
    saveButtonRef.current?.focus();
  }, [focusSaveRequest, pending]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    stopStepping();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setError(undefined);
    try {
      await onUpdateDelay(delay);
    } catch (caught) {
      setError(
        caught instanceof RegisteredSubtitleRefreshError
          ? t('v2_local_subtitles_refresh_error')
          : t('error_try_later')
      );
      setFocusSaveRequest((request) => request + 1);
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='flex min-w-0 flex-col gap-2'
      aria-busy={pending || undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <div className='grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2'>
        <StepButton
          step={-0.1}
          label={t('v2_local_subtitles_decrease_sync')}
          disabled={pending}
          startStepping={startStepping}
          stopStepping={stopStepping}
        >
          <MinusIcon />
        </StepButton>
        <NumberInput
          aria-label={t('v2_local_subtitles_sync_adjustment')}
          value={delay}
          disabled={pending}
          onChange={(value) => {
            setDelay(value);
            setError(undefined);
          }}
          step={0.1}
        />
        <StepButton
          step={0.1}
          label={t('v2_local_subtitles_increase_sync')}
          disabled={pending}
          startStepping={startStepping}
          stopStepping={stopStepping}
        >
          <PlusIcon />
        </StepButton>
      </div>
      {error && (
        <p id={errorId} role='alert' className='text-wrap text-sm text-destructive'>
          {error}
        </p>
      )}
      {pending && (
        <p role='status' className='sr-only'>
          {t('saving')}
        </p>
      )}
      <div className='grid grid-cols-2 gap-2'>
        <Button
          variant='outline'
          size='sm'
          type='button'
          disabled={pending}
          onClick={() => {
            stopStepping();
            closeEditMode();
          }}
        >
          <XIcon />
          {t('cancel')}
        </Button>
        <Button ref={saveButtonRef} size='sm' type='submit' disabled={pending}>
          <CheckIcon />
          {t(pending ? 'saving' : 'save')}
        </Button>
      </div>
    </form>
  );
}

interface StepButtonProps {
  step: number;
  label: string;
  disabled: boolean;
  startStepping: (step: number) => void;
  stopStepping: () => void;
  children: React.ReactNode;
}

function StepButton({ step, label, disabled, startStepping, stopStepping, children }: StepButtonProps) {
  return (
    <Button
      variant='outline'
      size='icon'
      type='button'
      aria-label={label}
      disabled={disabled}
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
