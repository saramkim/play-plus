import { create } from 'zustand';

export const PAGE_NAMES = ['learning', 'subtitles', 'library', 'review'] as const;

export type PageName = (typeof PAGE_NAMES)[number];

interface PageState {
  currentPage: PageName;
  navigationLocked: boolean;
  setNavigationLocked: (navigationLocked: boolean) => void;
  setPage: (page: PageName) => void;
}

export type PageStore = ReturnType<typeof usePageStore.getState>;

export const usePageStore = create<PageState>((set, get) => ({
  currentPage: 'learning',
  navigationLocked: false,
  setNavigationLocked: (navigationLocked) => set({ navigationLocked }),
  setPage: (currentPage) => {
    if (get().navigationLocked) return;
    set({ currentPage });
  },
}));
