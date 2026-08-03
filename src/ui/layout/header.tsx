import { cn } from '@utils/helper';
import { t } from '@utils/i18n';

import { PAGE_NAMES, PageName, usePageStore } from '@/ui/store/page-store';

const pageTitleMap = {
  learning: t('v2_nav_learning'),
  subtitles: t('v2_nav_subtitles'),
  library: t('v2_nav_library'),
  review: t('v2_nav_review'),
} satisfies Record<PageName, string>;

export function Header() {
  const currentPage = usePageStore((state) => state.currentPage);
  const navigationLocked = usePageStore((state) => state.navigationLocked);
  const setPage = usePageStore((state) => state.setPage);

  return (
    <header className='shrink-0 border-b px-1'>
      <nav className='grid grid-cols-4' aria-label={t('v2_navigation_label')}>
        {PAGE_NAMES.map((page) => (
          <button
            key={page}
            type='button'
            disabled={navigationLocked}
            aria-current={currentPage === page ? 'page' : undefined}
            className={cn(
              'min-w-0 border-b-2 border-transparent px-1 py-2 text-xs leading-tight font-medium whitespace-normal break-words hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 min-[360px]:text-[13px]',
              currentPage === page && 'border-b-primary text-primary'
            )}
            onClick={() => {
              setPage(page);
              requestAnimationFrame(() => document.getElementById('main-content')?.focus());
            }}
          >
            {pageTitleMap[page]}
          </button>
        ))}
      </nav>
    </header>
  );
}
