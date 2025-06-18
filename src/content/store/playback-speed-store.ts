import { create } from 'zustand';

interface PlaybackSpeedState {
  currentSpeed: number;
  minSpeed: number;
  maxSpeed: number;
  speedStep: number;

  increaseSpeed: () => void;
  decreaseSpeed: () => void;
  resetSpeed: () => void;
}

const initialState = {
  currentSpeed: 1.0,
  minSpeed: 0.1,
  maxSpeed: 3.0,
  speedStep: 0.1,
};

export const usePlaybackSpeedStore = create<PlaybackSpeedState>((set, get) => ({
  ...initialState,

  increaseSpeed: () => {
    const { currentSpeed, maxSpeed, speedStep } = get();
    const newSpeed = Math.min(maxSpeed * 10, currentSpeed * 10 + speedStep * 10) / 10;
    set({ currentSpeed: newSpeed });
  },

  decreaseSpeed: () => {
    const { currentSpeed, minSpeed, speedStep } = get();
    const newSpeed = Math.max(minSpeed * 10, currentSpeed * 10 - speedStep * 10) / 10;
    set({ currentSpeed: newSpeed });
  },

  resetSpeed: () => {
    set({ currentSpeed: 1.0 });
  },
}));
