import { XMarkIcon as XMarkIconSolid } from '@heroicons/react/16/solid';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/20/solid';

import { usePopup, PopupStatus } from '@/ui/contexts/popup-context';
import { cn } from '@/ui/lib/utils';

const colorMap: Record<PopupStatus, string> = {
  success: 'text-primary',
  error: 'text-destructive',
  info: '',
  confirm: 'text-amber-500',
};

const iconMap: Record<PopupStatus, React.ElementType> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  info: InformationCircleIcon,
  confirm: QuestionMarkCircleIcon,
};

export function GlobalPopup() {
  const { popup, hidePopup, isOpen } = usePopup();

  if (!isOpen || !popup) return null;

  const { title, content, status, preventOutsideClick } = popup;

  const Icon = status !== undefined ? iconMap[status] : null;

  return (
    <div
      className='fixed inset-0 flex justify-center items-center bg-foreground/50 z-50'
      onClick={preventOutsideClick ? undefined : hidePopup}
    >
      <div
        className='relative bg-background rounded-md shadow-md p-4 min-w-[220px] mx-4'
        onClick={(e) => e.stopPropagation()}
      >
        <button className='absolute top-2 right-2 text-gray-500' onClick={hidePopup}>
          <XMarkIconSolid className='size-4' />
        </button>
        <div className='flex items-center gap-1 mb-2'>
          {Icon && <Icon className={cn('size-5', colorMap[status!])} />}
          <h2 className='text-[15px] font-medium'>{title}</h2>
        </div>
        <div>{content}</div>
      </div>
    </div>
  );
}
