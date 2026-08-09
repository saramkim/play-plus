import { create } from 'zustand';

type ListeningMissionActiveState = {
  active: boolean;
  setActive: (active: boolean) => void;
};

export const useListeningMissionActiveStore = create<ListeningMissionActiveState>((set) => ({
  active: false,
  setActive: (active) => set({ active }),
}));

export const isListeningMissionActive = () => {
  return useListeningMissionActiveStore.getState().active;
};
