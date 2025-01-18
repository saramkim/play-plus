import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/20/solid';
import { XMarkIcon as XMarkIconSolid } from '@heroicons/react/16/solid';
import { usePopup } from '../contexts/PopupContext';
import { PopupStatus } from '../contexts/PopupContext';
import { ReactElement } from 'react';

const colorMap: Record<PopupStatus, string> = {
  success: 'text-teal-500',
  error: 'text-rose-500',
  info: '',
  confirm: 'text-amber-500',
};

const iconMap: Record<PopupStatus, ReactElement> = {
  success: <CheckCircleIcon className='size-5' />,
  error: <XCircleIcon className='size-5' />,
  info: <InformationCircleIcon className='size-5' />,
  confirm: <QuestionMarkCircleIcon className='size-5' />,
};

function GlobalPopup() {
  const { popup, hidePopup, isOpen } = usePopup();

  if (!isOpen || !popup) return null;

  const { title, content, status, preventOutsideClick } = popup;

  return (
    <div
      className='fixed inset-0 flex justify-center items-center bg-black/50 z-50'
      onClick={preventOutsideClick ? undefined : hidePopup}
    >
      <div
        className='relative bg-white rounded-md shadow-md p-4 min-w-[220px] mx-4'
        onClick={(e) => e.stopPropagation()}
      >
        <button className='absolute top-2 right-2 text-gray-500' onClick={hidePopup}>
          <XMarkIconSolid className='size-4' />
        </button>
        <div className={`flex items-center gap-1 mb-2 ${status ? colorMap[status] : ''}`}>
          {status && iconMap[status]}
          <h2 className='text-[15px] font-bold'>{title}</h2>
        </div>
        <div>{content}</div>
      </div>
    </div>
  );
}

export default GlobalPopup;
