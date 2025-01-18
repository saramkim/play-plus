import { useEffect, useState } from 'react';
import { PAGE_NAME, PageName } from './utils/constants';
import { getLocalStorage, setLocalStorage } from './storage/storage';
import Header from './ui/Header';
import Footer from './ui/Footer';
import SavedSubtitlesPage from './ui/SavedSubtitlesPage';
import SubtitleSettingPage from './ui/SubtitleSettingPage';
import VideoSettingPage from './ui/VideoSettingPage';
import { usePopup } from './contexts/PopupContext';
import OnboardingContent from './ui/OnboardingContent';
import { getMessage } from './utils/i18n';

const pageList = Object.values(PAGE_NAME);

const { SAVED_SUBTITLES, SUBTITLE_SETTING, VIDEO_SETTING } = PAGE_NAME;

const pageMap = {
  [SAVED_SUBTITLES]: <SavedSubtitlesPage />,
  [SUBTITLE_SETTING]: <SubtitleSettingPage />,
  [VIDEO_SETTING]: <VideoSettingPage />,
};

function App() {
  const [page, setPage] = useState<PageName | null>(null);
  const { showPopup, hidePopup } = usePopup();

  useEffect(() => {
    (async () => {
      const isOnboardingComplete = await getLocalStorage('isOnboardingComplete');
      if (!isOnboardingComplete) {
        showPopup({
          title: getMessage('onboarding_title'),
          content: <OnboardingContent hidePopup={hidePopup} />,
          status: 'info',
          preventOutsideClick: true,
        });
      }

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
    <div className='h-screen flex flex-col select-none text-nowrap'>
      <Header pageList={pageList} currentPage={page} navigate={navigate} />
      <main className='h-full overflow-auto'>{pageMap[page]}</main>
      <Footer />
    </div>
  );
}

export default App;
