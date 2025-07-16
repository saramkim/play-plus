import { create } from 'zustand';

interface FocusModeState {
  isFocusMode: boolean;
  setFocusMode: (isFocusMode: boolean) => void;
  toggle: () => void;
}

const initialState = {
  isFocusMode: false,
};

export const useFocusModeStore = create<FocusModeState>((set) => ({
  ...initialState,

  setFocusMode: (isFocusMode: boolean) => set({ isFocusMode }),
  toggle: () => set((state) => ({ isFocusMode: !state.isFocusMode })),
}));
