import { t } from '../utils/i18n';

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

function MessagePopup(props: MessagePopupProps) {
  const { message, type, hidePopup } = props;
  return (
    <div className='flex flex-col gap-3'>
      <p className='whitespace-pre-line'>{message}</p>

      <div className='flex gap-2 w-full'>
        {type === 'confirm' && (
          <button className='button bg-gray-500 w-full' onClick={hidePopup}>
            {t('cancel')}
          </button>
        )}
        <button
          className='button bg-teal-500 w-full'
          onClick={() => {
            if (type === 'confirm') props.onConfirm();
            hidePopup();
          }}
        >
          {t('confirm')}
        </button>
      </div>
    </div>
  );
}

export default MessagePopup;
