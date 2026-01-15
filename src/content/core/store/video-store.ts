import { create } from 'zustand';

interface VideoState {
  currentTime: number;
  hasVideo: boolean;
  detectionStatus: VideoDetectionStatus;
  setCurrentTime: (t: number) => void;
  setHasVideo: (hasVideo: boolean) => void;
  setDetectionStatus: (status: VideoDetectionStatus) => void;
}

export const useVideoStore = create<VideoState>((set) => ({
  currentTime: 0,
  hasVideo: false,
  detectionStatus: 'idle',
  setCurrentTime: (t) => set({ currentTime: t }),
  setHasVideo: (hasVideo) => set({ hasVideo }),
  setDetectionStatus: (status) => set({ detectionStatus: status }),
}));

export type VideoDetectionStatus = 'idle' | 'detecting' | 'detected' | 'failed';
