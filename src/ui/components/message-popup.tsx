import { t } from '@utils/i18n';

import { Button } from './button';

interface MessagePopupBase {
  message: string;
  hidePopup: () => void;
}
interface AlertPopupProps extends MessagePopupBase {
  type: 'alert';
}
interface ConfirmPopupProps extends MessagePopupBase {
  type: 'confirm';
  onConfirm: () => void;
}
type MessagePopupProps = AlertPopupProps | ConfirmPopupProps;

export function MessagePopup(props: MessagePopupProps) {
  const { message, type, hidePopup } = props;
  return (
    <div className='flex flex-col gap-3'>
      <p className='whitespace-pre-line text-muted-foreground'>{message}</p>
      <div className='flex gap-1.5 w-full justify-end'>
        {type === 'confirm' && (
          <Button variant='outline' size='sm' onClick={hidePopup}>
            {t('cancel')}
          </Button>
        )}
        <Button
          size='sm'
          onClick={() => {
            if (type === 'confirm') props.onConfirm();
            hidePopup();
          }}
        >
          {t('confirm')}
        </Button>
      </div>
    </div>
  );
}
