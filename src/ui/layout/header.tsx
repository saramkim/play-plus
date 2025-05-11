import { useRef } from 'react';

import { PAGE_NAME } from '@utils/constants';
import { t } from '@utils/i18n';

import { useDragScroll } from '@/ui/hooks/use-drag-scroll';
import { usePageStore } from '@/ui/store/page-store';

const pageList = Object.values(PAGE_NAME);
const pageTitleMap = {
  [PAGE_NAME.SUBTITLE_SETTING]: t('subtitle_setting'),
  [PAGE_NAME.VIDEO_SETTING]: t('video_setting'),
  [PAGE_NAME.REVIEW]: t('review'),
  [PAGE_NAME.SUBTITLE_REGISTRATION]: t('subtitle_registration'),
  [PAGE_NAME.SUBTITLE_ANALYSIS]: t('subtitle_analysis'),
};

export function Header() {
  const currentPage = usePageStore((state) => state.currentPage);
  const setPage = usePageStore((state) => state.setPage);
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { scrollRef, eventHandlers, allowClick } = useDragScroll();

  const handleTabClick = (index: number) => {
    if (!allowClick) return;
    setPage(pageList[index]);
    tabRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  return (
    <div
      ref={scrollRef}
      {...eventHandlers}
      className='flex justify-between px-2 pt-1 overflow-x-auto border-b scrollbar-hidden'
    >
      {pageList.map((page, index) => (
        <div
          ref={(el) => {
            tabRefs.current[index] = el;
          }}
          key={page}
          onClick={() => handleTabClick(index)}
          className={`w-full p-2 text-center cursor-pointer text-[15px] rounded-t-md hover:bg-gray-100 ${
            currentPage === page ? 'border-b-2 border-b-foreground font-bold' : 'text-gray-500 font-medium'
          }`}
        >
          {pageTitleMap[page]}
        </div>
      ))}
    </div>
  );
}
