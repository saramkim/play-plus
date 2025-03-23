import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';

interface MessageContentProps {
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  hideModal: () => void;
  onConfirm?: () => void;
}

export function MessageContent({ title, message, type, hideModal, onConfirm }: MessageContentProps) {
  return (
    <div className='flex flex-col gap-2'>
      <h2 className='text-[15px] font-bold'>{title}</h2>
      <div className='flex flex-col gap-3'>
        <p className='whitespace-pre-line text-muted-foreground'>{message}</p>
        <div className='flex gap-1.5 w-full justify-end'>
          {type === 'confirm' && (
            <Button variant='outline' size='sm' onClick={hideModal}>
              {t('cancel')}
            </Button>
          )}
          <Button
            size='sm'
            onClick={() => {
              onConfirm?.();
              hideModal();
            }}
          >
            {t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
