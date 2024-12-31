import { usePopup } from '../contexts/PopupContext';
import { PopupStatus } from '../contexts/PopupContext';

const iconMap: Record<PopupStatus, string> = {
  success: '✔️',
  error: '❌',
  info: '⚠️',
};

function GlobalPopup() {
  const { popup, hidePopup, isOpen } = usePopup();

  if (!isOpen || !popup) return null;

  const { title, content, status } = popup;

  return (
    <div className='fixed inset-0 flex justify-center items-center bg-black/50 z-50' onClick={hidePopup}>
      <div className='relative bg-white rounded-md shadow-md p-4 min-w-[220px]' onClick={(e) => e.stopPropagation()}>
        <button className='absolute top-2 right-2 text-gray-500 hover:text-gray-800' onClick={hidePopup}>
          X
        </button>
        <div className='flex items-center gap-1 mb-2 text-[15px]'>
          {status && <span>{iconMap[status]}</span>}
          <h2 className='font-bold'>{title}</h2>
        </div>
        <div>{content}</div>
      </div>
    </div>
  );
}

export default GlobalPopup;
