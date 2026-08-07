import { useCallback, useEffect, useRef, useState } from 'react';

import { learningCardSchema } from '@storage/v2/schema';
import { createV2SyncStorage } from '@storage/v2/sync-storage';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';

import { createMessageLearningCardStorage } from '@/ui/adapters/v2-learning-card-storage';
import { Button } from '@/ui/components/button';
import { FirstEntry, V2_ONBOARDING_COMPLETE_KEY } from '@/ui/features/first-entry/first-entry';
import { FocusedReview } from '@/ui/features/focused-review/focused-review';
import { LearningCardLibrary } from '@/ui/features/learning-library/learning-card-library';
import { createLearningSettingsStore } from '@/ui/features/learning-settings/learning-settings-store';
import { ConnectionStatus } from '@/ui/layout/connection-status';
import { Footer } from '@/ui/layout/footer';
import { Header } from '@/ui/layout/header';
import { LearningSettingsPage } from '@/ui/pages/learning-settings-page';
import { SubtitleUploadPage } from '@/ui/pages/subtitle-upload-page';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

const syncStorage = createV2SyncStorage(chrome.storage.sync);
const useLearningSettingsStore = createLearningSettingsStore(syncStorage);
const learningCardStorage = createMessageLearningCardStorage();

type BootState = 'checking' | 'error' | 'first-entry' | 'ready';

export function App() {
  const [bootState, setBootState] = useState<BootState>('checking');
  const [cardRevision, setCardRevision] = useState(0);
  const currentPage = usePageStore((state) => state.currentPage);
  const setPage = usePageStore((state) => state.setPage);
  const learningProfile = useLearningSettingsStore((state) => state.learningProfile);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stopNormalConsumers = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  const initializeNormalConsumers = useCallback(async () => {
    stopNormalConsumers();
    const settingsRegistration = await useLearningSettingsStore.getState().initialize();
    try {
      const removeTabListener = await useTabStore.getState().initialize();
      cleanupRef.current = () => {
        settingsRegistration.remove();
        removeTabListener();
      };
      setBootState('ready');
    } catch (error) {
      settingsRegistration.remove();
      throw error;
    }
  }, [stopNormalConsumers]);

  const checkReadiness = useCallback(async (retry = false) => {
    setBootState('checking');
    try {
      const response = await sendMessage(retry ? 'retryV2Readiness' : 'getV2Readiness');
      if (!response.success || response.data.status !== 'ready') {
        stopNormalConsumers();
        setBootState('error');
        return;
      }
      if (localStorage.getItem(V2_ONBOARDING_COMPLETE_KEY) !== 'true') {
        setBootState('first-entry');
        return;
      }
      await initializeNormalConsumers();
    } catch {
      stopNormalConsumers();
      setBootState('error');
    }
  }, [initializeNormalConsumers, stopNormalConsumers]);

  useEffect(() => {
    void checkReadiness();
    return stopNormalConsumers;
  }, [checkReadiness, stopNormalConsumers]);

  useEffect(() => {
    if (bootState !== 'ready') return;
    const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
      const change = changes.learningCards;
      if (!change) return;
      const value = change.newValue;
      if (value === undefined || !learningCardSchema.array().safeParse(value).success) {
        stopNormalConsumers();
        setBootState('error');
        return;
      }
      setCardRevision((revision) => revision + 1);
    };
    chrome.storage.local.onChanged.addListener(listener);
    return () => chrome.storage.local.onChanged.removeListener(listener);
  }, [bootState, stopNormalConsumers]);

  if (bootState === 'checking') {
    return <p role='status' className='p-6 text-center text-sm'>{t('v2_readiness_loading')}</p>;
  }
  if (bootState === 'error') {
    return (
      <main className='flex h-screen flex-col items-center justify-center gap-3 p-6 text-center'>
        <h1 className='text-lg font-semibold'>{t('v2_readiness_unavailable_title')}</h1>
        <p className='text-wrap text-sm text-muted-foreground'>{t('v2_readiness_unavailable_description')}</p>
        <Button type='button' onClick={() => void checkReadiness(true)}>{t('v2_retry')}</Button>
      </main>
    );
  }
  if (bootState === 'first-entry') {
    return <FirstEntry onComplete={initializeNormalConsumers} />;
  }

  const page = (() => {
    if (currentPage === 'learning') return <LearningSettingsPage store={useLearningSettingsStore} />;
    if (currentPage === 'subtitles') {
      return (
        <SubtitleUploadPage
          cardRevision={cardRevision}
          learningCardStorage={learningCardStorage}
          learningProfile={learningProfile}
        />
      );
    }
    if (currentPage === 'library') {
      return <LearningCardLibrary refreshRevision={cardRevision} storage={learningCardStorage} />;
    }
    return (
      <FocusedReview
        storage={learningCardStorage}
        onOpenLibrary={() => setPage('library')}
        onOpenOriginalVideo={async (source) => {
          const response = await sendMessage('viewVideo', { url: source.url, startTime: source.startTime });
          if (!response.success) throw new Error(t('v2_review_open_video_error'));
        }}
      />
    );
  })();

  return (
    <div className='flex h-screen flex-col text-nowrap select-none'>
      <ConnectionStatus />
      <Header />
      <main id='main-content' tabIndex={-1} className='min-h-0 flex-1 overflow-hidden outline-none'>{page}</main>
      <Footer />
    </div>
  );
}
