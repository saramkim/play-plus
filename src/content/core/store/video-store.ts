import { create } from 'zustand';

interface VideoState {
  currentTime: number;
  setCurrentTime: (t: number) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  currentTime: 0,
  setCurrentTime: (t) => set({ currentTime: t }),
}));
