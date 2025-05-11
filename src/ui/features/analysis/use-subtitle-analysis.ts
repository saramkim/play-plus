import { useEffect, useMemo, useState } from 'react';

import { getLocalStorage, setLocalStorage } from '@storage/index';
import { getLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { DefaultSubtitleLanguage, LANGUAGES } from '@utils/constants';
import { findSubtitleIndex, stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { onMessage, sendMessageToTab } from '@utils/message/index';
import { SubtitleData } from '@utils/parse';
import { toast } from 'sonner';

import { useTabInfo } from '@/ui/hooks/use-tab-info';
import { useConfigStore } from '@/ui/store/config-store';
import { usePageParams } from '@/ui/store/page-store';

const isDefaultSubtitleLanguage = (language: string) => language === 'en' || language === 'ko';

export function useSubtitleAnalysis() {
  const [subtitles, setSubtitles] = useState<SubtitleData[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const { activeTab, tabInfo } = useTabInfo();
  const params = usePageParams('subtitle-analysis');
  const primarySubtitleLanguage = useConfigStore((state) => state.configs.primarySubtitle.language);
  const primarySubtitleDelay = useConfigStore((state) => state.configs.primarySubtitle.delay);
  const secondarySubtitleLanguage = useConfigStore((state) => state.configs.secondarySubtitle.language);
  const secondarySubtitleDelay = useConfigStore((state) => state.configs.secondarySubtitle.delay);
  const [subtitleId, setSubtitleId] = useState<DefaultSubtitleLanguage | SubtitleId>(
    params?.id || tabInfo?.primarySubtitle || primarySubtitleLanguage
  );

  const activeIndex = useMemo(() => findSubtitleIndex(subtitles, currentTime), [subtitles, currentTime]);
  const defaultSubtitleOptions = useMemo(() => {
    return tabInfo
      ? Object.keys(tabInfo)
          .filter(isDefaultSubtitleLanguage)
          .filter((key) => tabInfo[key])
          .map((key) => ({ id: key, label: t(LANGUAGES[key]) }))
      : [];
  }, [tabInfo]);

  useEffect(() => {
    const isPrimarySubtitle = subtitleId === (tabInfo?.primarySubtitle || primarySubtitleLanguage);
    const isSecondarySubtitle = subtitleId === (tabInfo?.secondarySubtitle || secondarySubtitleLanguage);
    const calculateTime = (time: number) =>
      isPrimarySubtitle ? time + primarySubtitleDelay : isSecondarySubtitle ? time + secondarySubtitleDelay : time;

    (async () => {
      const subtitle = isDefaultSubtitleLanguage(subtitleId)
        ? tabInfo?.[subtitleId] || []
        : await getLocalSubtitle(subtitleId);

      setSubtitles(
        subtitle.map(({ text, start, end }) => ({
          text: stripTags(text),
          start: calculateTime(start),
          end: calculateTime(end),
        }))
      );
    })();
  }, [
    subtitleId,
    tabInfo,
    primarySubtitleLanguage,
    primarySubtitleDelay,
    secondarySubtitleLanguage,
    secondarySubtitleDelay,
  ]);

  useEffect(() => {
    (async () => {
      if (!activeTab?.id) return;
      const response = await sendMessageToTab(activeTab.id, 'getVideoTime');
      if (response.success) setCurrentTime(response.data);
      else setCurrentTime(0);
    })();
  }, [activeTab]);

  useEffect(() => {
    const { remove } = onMessage(({ message, params }) => {
      if (message === 'updateCurrentTime') {
        setCurrentTime(params);
      }
    });
    return remove;
  }, []);

  const handleSaveSubtitle = async (subtitle: SubtitleData) => {
    const content = subtitle.text;
    const prevData = (await getLocalStorage('savedSubtitles')) || [];
    const isDuplicated = prevData.some(({ content: prevContent }) => prevContent === content);

    if (isDuplicated) {
      toast.error(t('error_duplicate_subtitle'));
    } else {
      const data = {
        content,
        url: activeTab?.url || '',
        startTime: subtitle.start,
        savedAt: new Date().toISOString(),
      };
      await setLocalStorage('savedSubtitles', [...prevData, data]);
      toast.success(t('success_save_subtitle'));
    }
  };

  const handlePlayVideo = (startTime: number) => {
    if (activeTab?.id) {
      sendMessageToTab(activeTab.id, 'playVideo', { startTime });
    } else {
      toast.error(t('error_video_not_found'));
    }
  };

  return {
    subtitles,
    subtitleId,
    setSubtitleId,
    activeIndex,
    defaultSubtitleOptions,
    handlePlayVideo,
    handleSaveSubtitle,
  };
}
