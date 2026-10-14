import { useRef, useState } from 'react';

import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';

interface MessageContentProps {
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  hideModal: () => void;
  onConfirm?: () => void | Promise<void>;
  setPending?: (pending: boolean) => void;
  errorMessage?: (error: unknown) => string;
}

export function MessageContent({ title, message, type, hideModal, onConfirm, setPending, errorMessage }: MessageContentProps) {
  const pendingRef = useRef(false);
  const [pending, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setBusy(true);
    setPending?.(true);
    setError('');
    try {
      const result = onConfirm?.();
      if (result) await result;
      setPending?.(false);
      hideModal();
    } catch (error) {
      setError(errorMessage?.(error) ?? t('error_try_later'));
    } finally {
      pendingRef.current = false;
      setBusy(false);
      setPending?.(false);
    }
  };
  return (
    <div className='flex flex-col gap-2'>
      <h2 className='text-[15px] font-bold'>{title}</h2>
      <div className='flex flex-col gap-3'>
        <p className='whitespace-pre-line text-muted-foreground'>{message}</p>
        {error && <p role='alert'>{error}</p>}
        <div className='flex gap-1.5 w-full justify-end'>
          {type === 'confirm' && (
            <Button variant='outline' size='sm' disabled={pending} onClick={hideModal}>
              {t('cancel')}
            </Button>
          )}
          <Button
            size='sm'
            disabled={pending}
            onClick={confirm}
          >
            {t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
