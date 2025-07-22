import { create } from 'zustand';

export type LoopType = 'subtitle' | 'manual';

interface LoopState {
  isLooping: boolean;
  loopType: LoopType;
  startTime: number;
  endTime: number;

  setLooping: (isLooping: boolean, loopType?: LoopType) => void;
  setStartTime: (time: number) => void;
  setEndTime: (time: number) => void;
  reset: () => void;
}

const initialState = {
  isLooping: false,
  loopType: 'manual',
  startTime: 0,
  endTime: 0,
} as const;

export const useLoopStore = create<LoopState>((set) => ({
  ...initialState,

  setLooping: (isLooping, loopType = 'manual') => {
    set({ isLooping, loopType });
  },
  setStartTime: (time: number) => {
    set({ startTime: Math.max(0, time) });
  },
  setEndTime: (time: number) => {
    set({ endTime: Math.max(0, time) });
  },
  reset: () => {
    set(initialState);
  },
}));
