
import { PAGE_NAME } from '@utils/constants';
import { cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { useRef } from 'react';

import { useDragScroll } from '@/ui/hooks/use-drag-scroll';
import { usePageStore } from '@/ui/store/page-store';

const pageList = Object.values(PAGE_NAME);
const pageTitleMap = {
  [PAGE_NAME.SUBTITLE_SETTING]: t('subtitle_setting'),
  [PAGE_NAME.VIDEO_SETTING]: t('video_setting'),
  [PAGE_NAME.REVIEW]: t('review'),
  [PAGE_NAME.SUBTITLE_UPLOAD]: t('subtitle_upload'),
  [PAGE_NAME.SUBTITLE_ANALYSIS]: t('subtitle_analysis'),
};

export function Header() {
  const currentPage = usePageStore((state) => state.currentPage);
  const setPage = usePageStore((state) => state.setPage);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { scrollRef, eventHandlers, allowClick } = useDragScroll();

  const handleTabClick = (index: number) => {
    if (!allowClick) return;
    setPage(pageList[index]);
    tabRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <header ref={scrollRef} {...eventHandlers} className='flex overflow-x-auto border-b scrollbar-hidden px-1'>
      {pageList.map((page, index) => (
        <button
          ref={(el) => {
            tabRefs.current[index] = el;
          }}
          key={page}
          onClick={() => handleTabClick(index)}
          className={cn(
            'flex-1 p-2 text-[15px] hover:bg-gray-100 font-medium',
            currentPage === page ? 'border-b-2 border-b-primary text-primary pt-2.5' : 'text-gray-500'
          )}
        >
          {pageTitleMap[page]}
        </button>
      ))}
    </header>
  );
}
