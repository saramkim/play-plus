import { useEffect, useState } from 'react';

import { setStorageAll } from '@storage/index';
import { LEARNING_CONFIG } from '@storage/preset';
import { PAGE_NAME, PageName } from '@utils/constants';
import { t } from '@utils/i18n';

import { usePopup } from './contexts/popup-context';
import { Footer } from './layout/footer';
import { Header } from './layout/header';
import { OnboardingContent } from './layout/onboarding-content';
import { ReviewPage } from './pages/review-page';
import { SubtitleRegistrationPage } from './pages/subtitle-registration-page';
import { SubtitleSettingPage } from './pages/subtitle-setting-page';
import { VideoSettingPage } from './pages/video-setting-page';

const pageList = Object.values(PAGE_NAME);

const { SUBTITLE_SETTING, VIDEO_SETTING, REVIEW, SUBTITLE_REGISTRATION } = PAGE_NAME;
const LAST_VIEWED_PAGE_KEY = 'lastViewedPage';
const IS_ONBOARDING_COMPLETE_KEY = 'isOnboardingComplete';

const pageMap = {
  [SUBTITLE_SETTING]: <SubtitleSettingPage />,
  [VIDEO_SETTING]: <VideoSettingPage />,
  [REVIEW]: <ReviewPage />,
  [SUBTITLE_REGISTRATION]: <SubtitleRegistrationPage />,
};

export function App() {
  const [page, setPage] = useState<PageName>(
    () => (localStorage.getItem(LAST_VIEWED_PAGE_KEY) as PageName) || pageList[0]
  );
  const { showPopup, hidePopup } = usePopup();

  useEffect(() => {
    const isOnboardingComplete = localStorage.getItem(IS_ONBOARDING_COMPLETE_KEY);
    if (isOnboardingComplete) return;

    showPopup({
      title: t('onboarding_title'),
      content: (
        <OnboardingContent
          handleOnboardingComplete={async (state) => {
            if (state.isOptimizing) {
              await setStorageAll(LEARNING_CONFIG);
            }
            localStorage.setItem(IS_ONBOARDING_COMPLETE_KEY, 'true');
            hidePopup();
          }}
        />
      ),
      status: 'info',
      preventOutsideClick: true,
    });
  }, []);

  return (
    <div className='h-screen flex flex-col select-none text-nowrap'>
      <Header
        pageList={pageList}
        currentPage={page}
        navigate={(page) => {
          setPage(page);
          localStorage.setItem(LAST_VIEWED_PAGE_KEY, page);
        }}
      />
      <main className='h-full overflow-auto'>{pageMap[page]}</main>
      <Footer />
    </div>
  );
}
