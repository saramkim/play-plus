import { create } from 'zustand';

export type LoopType = 'subtitle' | 'manual';

interface LoopState {
  isLooping: boolean;
  loopType: LoopType | null;
  isMarkerShowing: boolean;
  startTime: number;
  endTime: number;

  setLooping: (isLooping: boolean, loopType?: LoopType) => void;
  setMarkerShowing: (showing: boolean) => void;
  setStartTime: (time: number) => void;
  setEndTime: (time: number) => void;
  reset: () => void;
}

const initialState = {
  isLooping: false,
  loopType: null,
  isMarkerShowing: false,
  startTime: 0,
  endTime: 0,
};

export const useLoopStore = create<LoopState>((set) => ({
  ...initialState,

  setLooping: (isLooping: boolean, loopType: LoopType = 'manual') => {
    set({
      isLooping,
      loopType: isLooping ? loopType : null,
    });
  },

  setMarkerShowing: (showing: boolean) => {
    set({ isMarkerShowing: showing });
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
