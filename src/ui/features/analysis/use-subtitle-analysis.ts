import { useEffect, useMemo, useState } from 'react';

import { getLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { DefaultSubtitleLanguage, LANGUAGES , COUPANG_PLAY_VIDEO_URL_LIST } from '@utils/constants';
import { findSubtitleIndex, stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { onMessage, sendMessageToTab } from '@utils/message/index';
import { SubtitleData } from '@utils/parse';
import { toast } from 'sonner';

import { useSavedSubtitle } from '@/ui/features/subtitle/use-saved-subtitle';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { useConfigStore } from '@/ui/store/config-store';
import { usePageParams } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

const isDefaultSubtitleLanguage = (language: string) => language === 'en' || language === 'ko';

export function useSubtitleAnalysis() {
  const [subtitles, setSubtitles] = useState<SubtitleData[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const { subtitles: savedSubtitles, saveSubtitle, deleteSubtitle } = useSavedSubtitle();
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const params = usePageParams('subtitle-analysis');
  const primarySubtitleLanguage = useConfigStore((state) => state.configs.primarySubtitle.language);
  const { subtitles: uploadedSubtitles } = useUploadedSubtitles();
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

  const isSubtitleSaved = useMemo(() => {
    return (content: string) => savedSubtitles.some((saved) => saved.content === content);
  }, [savedSubtitles]);

  useEffect(() => {
    (async () => {
      if (isDefaultSubtitleLanguage(subtitleId)) {
        const subtitle = tabInfo?.[subtitleId] || [];
        setSubtitles(subtitle.map(({ text, start, end }) => ({ text: stripTags(text), start, end })));
      } else {
        const subtitle = await getLocalSubtitle(subtitleId);
        const delay = uploadedSubtitles.find(({ id }) => id === subtitleId)?.delay || 0;
        setSubtitles(
          subtitle.map(({ text, start, end }) => ({ text: stripTags(text), start: start + delay, end: end + delay }))
        );
      }
    })();
  }, [subtitleId, tabInfo, uploadedSubtitles]);

  useEffect(() => {
    (async () => {
      if (!activeTab?.id || !COUPANG_PLAY_VIDEO_URL_LIST.some((url) => activeTab.url?.startsWith(url))) {
        setCurrentTime(0);
        return;
      }
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

  const handleToggleSubtitle = async (subtitle: SubtitleData) => {
    const content = subtitle.text;
    const isSaved = isSubtitleSaved(content);

    if (isSaved) {
      await deleteSubtitle(content);
    } else {
      await saveSubtitle(content, activeTab?.url || '', subtitle.start);
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
    handleToggleSubtitle,
    isSubtitleSaved,
  };
}
