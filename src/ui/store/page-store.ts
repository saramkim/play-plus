import { PAGE_NAME, PageName } from '@utils/constants';
import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

type PageParams = {
  [PAGE_NAME.SUBTITLE_SETTING]: never;
  [PAGE_NAME.VIDEO_SETTING]: never;
  [PAGE_NAME.REVIEW]: never;
  [PAGE_NAME.SUBTITLE_ANALYSIS]: never;
  [PAGE_NAME.SUBTITLE_REGISTRATION]: never;
};

export type PageStore = ReturnType<typeof usePageStore.getState>;

export const usePageStore = create(
  persist(
    combine(
      {
        currentPage: Object.values(PAGE_NAME)[0],
        params: {} as Partial<PageParams>,
      },
      (set, get) => ({
        setPage: <T extends PageName>(page: T, params?: PageParams[T]) =>
          set({ currentPage: page, params: { [page]: params } }),
        getParams: (page: PageName) => get().params[page],
      })
    ),
    {
      name: 'page-store',
      partialize: (state) => ({ currentPage: state.currentPage }),
    }
  )
);

export const usePageParams = (page: PageName) => {
  return usePageStore.getState().getParams(page);
};
