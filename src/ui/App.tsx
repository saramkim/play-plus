import { getLocalStorage, setLocalStorage } from '@storage/index';
import { PAGE_NAME, PageName } from '@utils/constants';
import { t } from '@utils/i18n';
import { useEffect, useState } from 'react';
import Footer from './components/layout/Footer';
import Header from './components/layout/Header';
import OnboardingContent from './components/layout/OnboardingContent';
import { usePopup } from './contexts/PopupContext';
import ReviewPage from './pages/ReviewPage';
import SubtitleRegistrationPage from './pages/SubtitleRegistrationPage';
import SubtitleSettingPage from './pages/SubtitleSettingPage';
import VideoSettingPage from './pages/VideoSettingPage';

const pageList = Object.values(PAGE_NAME);

const { SUBTITLE_SETTING, VIDEO_SETTING, REVIEW, SUBTITLE_REGISTRATION } = PAGE_NAME;

const pageMap = {
  [SUBTITLE_SETTING]: <SubtitleSettingPage />,
  [VIDEO_SETTING]: <VideoSettingPage />,
  [REVIEW]: <ReviewPage />,
  [SUBTITLE_REGISTRATION]: <SubtitleRegistrationPage />,
};

function App() {
  const [page, setPage] = useState<PageName | null>(null);
  const { showPopup, hidePopup } = usePopup();

  useEffect(() => {
    (async () => {
      const isOnboardingComplete = await getLocalStorage('isOnboardingComplete');
      if (!isOnboardingComplete) {
        showPopup({
          title: t('onboarding_title'),
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
