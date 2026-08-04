import { create } from 'zustand';

export const PAGE_NAMES = ['learning', 'subtitles', 'library', 'review'] as const;

export type PageName = (typeof PAGE_NAMES)[number];

interface PageState {
  currentPage: PageName;
  navigationLockTokens: ReadonlySet<symbol>;
  navigationLocked: boolean;
  acquireNavigationLock: () => () => void;
  setNavigationLocked: (navigationLocked: boolean) => void;
  setPage: (page: PageName) => void;
}

export type PageStore = ReturnType<typeof usePageStore.getState>;

const LEGACY_NAVIGATION_LOCK_TOKEN = Symbol('legacy-navigation-lock');

export const usePageStore = create<PageState>((set, get) => ({
  currentPage: 'learning',
  navigationLockTokens: new Set(),
  navigationLocked: false,
  acquireNavigationLock: () => {
    const token = Symbol('navigation-lock');
    set((state) => updateNavigationLock(state.navigationLockTokens, token, true));

    let released = false;
    return () => {
      if (released) return;
      released = true;
      set((state) => updateNavigationLock(state.navigationLockTokens, token, false));
    };
  },
  setNavigationLocked: (navigationLocked) =>
    set((state) =>
      updateNavigationLock(
        state.navigationLockTokens,
        LEGACY_NAVIGATION_LOCK_TOKEN,
        navigationLocked
      )
    ),
  setPage: (currentPage) => {
    if (get().navigationLocked) return;
    set({ currentPage });
  },
}));

const updateNavigationLock = (
  currentTokens: ReadonlySet<symbol>,
  token: symbol,
  locked: boolean
) => {
  const navigationLockTokens = new Set(currentTokens);
  if (locked) navigationLockTokens.add(token);
  else navigationLockTokens.delete(token);

  return {
    navigationLockTokens,
    navigationLocked: navigationLockTokens.size > 0,
  };
};
