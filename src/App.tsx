import { useEffect, useState } from 'react';
import { PAGE_NAME, PageName } from './utils/constants';
import { getLocalStorage, setLocalStorage } from './utils/storage';
import Header from './ui/Header';
import Footer from './ui/Footer';
import SavedSubtitlesPage from './ui/SavedSubtitlesPage';
import SubtitleSettingPage from './ui/SubtitleSettingPage';
import VideoSettingPage from './ui/VideoSettingPage';

const pageList = Object.values(PAGE_NAME);

const { SAVED_SUBTITLES, SUBTITLE_SETTING, VIDEO_SETTING } = PAGE_NAME;

const pageMap = {
  [SAVED_SUBTITLES]: <SavedSubtitlesPage />,
  [SUBTITLE_SETTING]: <SubtitleSettingPage />,
  [VIDEO_SETTING]: <VideoSettingPage />,
};

function App() {
  const [page, setPage] = useState<PageName | null>(null);

  useEffect(() => {
    (async () => {
      const lastViewedPage = await getLocalStorage('lastViewedPage');
      if (lastViewedPage && pageList.includes(lastViewedPage)) {
        setPage(lastViewedPage);
      } else {
        setPage(pageList[0]);
      }
    })();
  }, []);

  const navigate = (page: PageName) => {
    setPage(page);
    setLocalStorage('lastViewedPage', page);
  };

  if (!page) return null;

  return (
    <div className='h-screen flex flex-col select-none text-nowrap text-[13px]'>
      <Header pageList={pageList} currentPage={page} navigate={navigate} />
      <main className='h-full overflow-auto p-4'>{pageMap[page]}</main>
      <Footer />
    </div>
  );
}

export default App;
