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

export function useSubtitleAnalysis() {
  const [subtitles, setSubtitles] = useState<SubtitleData[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [subtitleId, setSubtitleId] = useState<DefaultSubtitleLanguage | SubtitleId>('en');
  const { activeTab, tabInfo } = useTabInfo();

  const activeIndex = useMemo(() => findSubtitleIndex(subtitles, currentTime), [subtitles, currentTime]);
  const defaultSubtitleOptions = useMemo(() => {
    return tabInfo
      ? Object.keys(tabInfo)
          .filter((key) => key === 'en' || key === 'ko')
          .filter((key) => tabInfo[key])
          .map((key) => ({ id: key, label: t(LANGUAGES[key]) }))
      : [];
  }, [tabInfo]);

  useEffect(() => {
    (async () => {
      const subtitle =
        subtitleId === 'en' || subtitleId === 'ko' ? tabInfo?.[subtitleId] || [] : await getLocalSubtitle(subtitleId);
      setSubtitles(subtitle.map(({ text, ...rest }) => ({ ...rest, text: stripTags(text) })));
    })();
  }, [subtitleId, tabInfo]);

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
