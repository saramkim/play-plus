import type { PlaybackContextStatus } from '@utils/playback-context';
import { create } from 'zustand';

type PlaybackContextStore = {
  status: PlaybackContextStatus | null;
  setStatus: (status: PlaybackContextStatus) => void;
};

export const usePlaybackContextStore = create<PlaybackContextStore>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));

export const isLearningPlaybackAvailable = () =>
  usePlaybackContextStore.getState().status?.learningAvailable === true;
