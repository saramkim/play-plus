import { create } from 'zustand';

export interface Toast {
  id: string;
  title: string;
  message: string;
  createdAt: number;
}

interface ToastStore {
  toasts: Toast[];

  addToast: (title: string, message: string) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  addToast: (title, message) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: Toast = {
      id,
      title,
      message,
      createdAt: Date.now(),
    };

    set((state) => ({
      toasts: [...state.toasts, toast],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));
