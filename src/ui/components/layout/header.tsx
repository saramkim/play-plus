import { PAGE_NAME, PageName } from '@utils/constants';
import { t } from '@utils/i18n';
import { useRef } from 'react';
import { useDragScroll } from '@/ui/hooks/use-drag-scroll';

const { SUBTITLE_SETTING, VIDEO_SETTING, REVIEW, SUBTITLE_REGISTRATION } = PAGE_NAME;
const pageMap = {
  [SUBTITLE_SETTING]: t('subtitle_setting'),
  [VIDEO_SETTING]: t('video_setting'),
  [REVIEW]: t('review'),
  [SUBTITLE_REGISTRATION]: t('subtitle_registration'),
};

interface HeaderProps {
  pageList: PageName[];
  currentPage: PageName;
  navigate: (page: PageName) => void;
}
function Header({ pageList, currentPage, navigate }: HeaderProps) {
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { scrollRef, eventHandlers, allowClick } = useDragScroll();

  const handleTabClick = (index: number) => {
    if (!allowClick) return;
    navigate(pageList[index]);
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
          {pageMap[page]}
        </div>
      ))}
    </div>
  );
}

export default Header;
