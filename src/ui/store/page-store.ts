import { PAGE_NAME, PageName } from '@utils/constants';
import { create } from 'zustand';
import { combine, persist } from 'zustand/middleware';

export const usePageStore = create(
  persist(
    combine(
      {
        currentPage: Object.values(PAGE_NAME)[0],
      },
      (set) => ({
        setPage: (page: PageName) => set({ currentPage: page }),
      })
    ),
    {
      name: 'page-store',
    }
  )
);
