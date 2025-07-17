import { create } from 'zustand';

interface GapSkipperState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const initialState = {
  enabled: false,
};

export const useGapSkipperStore = create<GapSkipperState>((set) => ({
  ...initialState,

  setEnabled: (enabled: boolean) => set({ enabled }),
}));
