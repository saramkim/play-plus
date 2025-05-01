import { useEffect, useMemo, useState } from 'react';

import { getLocalStorage, setLocalStorage } from '@storage/index';
import { getLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { LANGUAGES } from '@utils/constants';
import { findSubtitleIndex, stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { onMessage, sendMessageToTab } from '@utils/message';
import { SubtitleData } from '@utils/parse';
import { toast } from 'sonner';

import { useTabInfo } from '@/ui/hooks/use-tab-info';

type DefaultSubtitleId = 'en' | 'ko';

export function useSubtitleAnalysis() {
  const [subtitles, setSubtitles] = useState<SubtitleData[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [subtitleId, setSubtitleId] = useState<DefaultSubtitleId | SubtitleId>('en');
  const { activeTab, tabInfo } = useTabInfo();

  const activeIndex = useMemo(() => findSubtitleIndex(subtitles, currentTime), [subtitles, currentTime]);
  const defaultSubtitleOptions = useMemo(() => {
    return tabInfo
      ? Object.keys(tabInfo)
          .filter((key) => key === 'en' || key === 'ko')
          .map((key) => ({ id: key, label: t(LANGUAGES[key]) }))
      : [];
  }, [tabInfo]);

  useEffect(() => {
    (async () => {
      const subtitle =
        subtitleId === 'en' || subtitleId === 'ko' ? tabInfo?.[subtitleId] || [] : await getLocalSubtitle(subtitleId);
      setSubtitles(subtitle);
    })();
  }, [subtitleId, tabInfo]);

  useEffect(() => {
    const { remove } = onMessage((message) => {
      if (message.updateCurrentTime) {
        setCurrentTime(message.updateCurrentTime);
      }
    });
    return remove;
  }, []);

  const handleSaveSubtitle = async (subtitle: SubtitleData) => {
    const content = stripTags(subtitle.text);
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
