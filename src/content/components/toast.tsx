import { useEffect } from 'react';

import { useToastStore, type Toast as ToastType } from '@/content/store/toast-store';

interface ToastProps {
  toast: ToastType;
}

function Toast({ toast }: ToastProps) {
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(toast.id);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div className='flex flex-col gap-1.5 py-2 px-3 rounded text-white animate-in fade-in-0 slide-in-from-right-2 duration-300 bg-black/80 backdrop-blur-sm w-fit'>
      <span className='font-medium text-sm'>{toast.title}</span>
      <span className='text-xs'>{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className='absolute bottom-4 right-4 flex flex-col items-end gap-2'>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
