import { useEffect } from 'react';

import { setStorageAll } from '@storage/index';
import { LEARNING_CONFIG } from '@storage/preset';
import { PAGE_NAME } from '@utils/constants';

import { modal } from './components/modal';
import { Footer } from './layout/footer';
import { ConnectionStatus } from './layout/connection-status';
import { Header } from './layout/header';
import { OnboardingContent } from './layout/onboarding-content';
import { ReviewPage } from './pages/review-page';
import { SubtitleAnalysisPage } from './pages/subtitle-analysis-page';
import { SubtitleSettingPage } from './pages/subtitle-setting-page';
import { SubtitleUploadPage } from './pages/subtitle-upload-page';
import { VideoSettingPage } from './pages/video-setting-page';
import { useConfigStore } from './store/config-store';
import { usePageStore } from './store/page-store';
import { useTabStore } from './store/tab-store';

const IS_ONBOARDING_COMPLETE_KEY = 'isOnboardingComplete';

const pageMap = {
  [PAGE_NAME.SUBTITLE_SETTING]: <SubtitleSettingPage />,
  [PAGE_NAME.VIDEO_SETTING]: <VideoSettingPage />,
  [PAGE_NAME.REVIEW]: <ReviewPage />,
  [PAGE_NAME.SUBTITLE_ANALYSIS]: <SubtitleAnalysisPage />,
  [PAGE_NAME.SUBTITLE_UPLOAD]: <SubtitleUploadPage />,
};

export function App() {
  const currentPage = usePageStore((state) => state.currentPage);
  const initializeConfigs = useConfigStore((state) => state.initializeConfigs);
  const loading = useConfigStore((state) => state.loading);
  const initializeTab = useTabStore((state) => state.initialize);

  useEffect(() => {
    const isOnboardingComplete = localStorage.getItem(IS_ONBOARDING_COMPLETE_KEY);
    if (!isOnboardingComplete) {
      modal(
        <OnboardingContent
          handleOnboardingComplete={async (state) => {
            if (state.isOptimizing) {
              await setStorageAll(LEARNING_CONFIG);
            }
            localStorage.setItem(IS_ONBOARDING_COMPLETE_KEY, 'true');
            modal.hide();
          }}
        />
      );
    }

    let cleanup: (() => void) | undefined;
    (async () => {
      const { remove: removeConfigListener } = await initializeConfigs();
      const removeTabListener = await initializeTab();
      cleanup = () => {
        removeConfigListener();
        removeTabListener();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, []);

  return (
    <div className='h-screen flex flex-col select-none text-nowrap'>
      <ConnectionStatus />
      <Header />
      <main className='flex-1 overflow-auto'>{loading ? null : pageMap[currentPage]}</main>
      <Footer />
    </div>
  );
}
