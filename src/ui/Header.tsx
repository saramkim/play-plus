import { PAGE_NAME, PageName } from '../utils/constants';
import { getMessage } from '../utils/i18n';

const { SUBTITLE_SETTING, VIDEO_SETTING, REVIEW } = PAGE_NAME;
const pageMap = {
  [SUBTITLE_SETTING]: getMessage('subtitle_setting'),
  [VIDEO_SETTING]: getMessage('video_setting'),
  [REVIEW]: getMessage('review'),
};

interface HeaderProps {
  pageList: PageName[];
  currentPage: PageName;
  navigate: (page: PageName) => void;
}
function Header({ pageList, currentPage, navigate }: HeaderProps) {
  return (
    <div className='flex flex-col px-4 pt-4 border-b border-b-gray-300'>
      <div className='flex justify-between items-center gap-2'>
        {pageList.map((page) => (
          <div
            key={page}
            onClick={() => navigate(page)}
            className={`w-full px-1 text-center cursor-pointer text-[15px] ${
              currentPage === page
                ? 'text-black border-b-2 border-b-black font-bold translate-y-[1px]'
                : 'text-gray-500 font-medium hover:text-black'
            }`}
          >
            {pageMap[page]}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Header;
