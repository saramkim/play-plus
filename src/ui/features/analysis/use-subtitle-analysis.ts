import { useEffect, useMemo, useState } from 'react';

import { findSavedSubtitleCard } from '@storage/saved-subtitle';
import { getLocalSubtitle } from '@storage/subtitle';
import { COUPANG_PLAY_VIDEO_URL_LIST, DefaultSubtitleLanguage, LANGUAGES } from '@utils/constants';
import { findSubtitleIndex, stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { onMessage, sendMessageToTab } from '@utils/message/index';
import { SubtitleData } from '@utils/parse';
import { toast } from 'sonner';

import {
  buildAnalysisSavedSubtitleDraft,
  SubtitleTrackId,
  SubtitleTrackSnapshot,
} from '@/ui/features/analysis/saved-subtitle-card';
import { useSavedSubtitle } from '@/ui/features/subtitle/use-saved-subtitle';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { useConfigStore } from '@/ui/store/config-store';
import { usePageParams } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

const isDefaultSubtitleLanguage = (language: string): language is DefaultSubtitleLanguage =>
  language === 'en' || language === 'ko';

export function useSubtitleAnalysis() {
  const [selectedTrack, setSelectedTrack] = useState<SubtitleTrackSnapshot>();
  const [roleTracks, setRoleTracks] = useState<{
    primary?: SubtitleTrackSnapshot;
    secondary?: SubtitleTrackSnapshot;
  }>({});
  const [currentTime, setCurrentTime] = useState<number>(0);
  const { subtitles: savedSubtitles, saveSubtitle, deleteSubtitle } = useSavedSubtitle();
  const activeTab = useTabStore((state) => state.activeTab);
  const tabInfo = useTabStore((state) => state.tabInfo);
  const params = usePageParams('subtitle-analysis');
  const primarySubtitleLanguage = useConfigStore((state) => state.configs.primarySubtitle.language);
  const secondarySubtitleLanguage = useConfigStore((state) => state.configs.secondarySubtitle.language);
  const { subtitles: uploadedSubtitles } = useUploadedSubtitles();
  const [subtitleId, setSubtitleId] = useState<SubtitleTrackId>(
    params?.id || tabInfo?.primarySubtitle || primarySubtitleLanguage
  );
  const primaryTrackId = tabInfo?.primarySubtitle ?? primarySubtitleLanguage;
  const secondaryTrackId = tabInfo?.secondarySubtitle ?? secondarySubtitleLanguage;
  const subtitles = selectedTrack?.subtitles ?? [];

  const activeIndex = useMemo(() => findSubtitleIndex(subtitles, currentTime), [subtitles, currentTime]);
  const defaultSubtitleOptions = useMemo(() => {
    return tabInfo
      ? Object.keys(tabInfo)
          .filter(isDefaultSubtitleLanguage)
          .filter((key) => tabInfo[key])
          .map((key) => ({ id: key, label: t(LANGUAGES[key]) }))
      : [];
  }, [tabInfo]);

  const createDraft = (subtitle: SubtitleData) => {
    if (!selectedTrack) return undefined;
    return buildAnalysisSavedSubtitleDraft({
      selectedSubtitle: subtitle,
      selectedTrack,
      primaryTrack: roleTracks.primary,
      secondaryTrack: roleTracks.secondary,
      url: activeTab?.url || '',
    });
  };

  const isSubtitleSaved = (subtitle: SubtitleData) => {
    const draft = createDraft(subtitle);
    return draft ? Boolean(findSavedSubtitleCard(savedSubtitles, draft)) : false;
  };

  useEffect(() => {
    let cancelled = false;
    void loadSubtitleTrack(subtitleId, tabInfo, uploadedSubtitles).then((track) => {
      if (!cancelled) setSelectedTrack(track);
    });
    return () => {
      cancelled = true;
    };
  }, [subtitleId, tabInfo, uploadedSubtitles]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadSubtitleTrack(primaryTrackId, tabInfo, uploadedSubtitles),
      loadSubtitleTrack(secondaryTrackId, tabInfo, uploadedSubtitles),
    ]).then(([primary, secondary]) => {
      if (!cancelled) setRoleTracks({ primary, secondary });
    });
    return () => {
      cancelled = true;
    };
  }, [primaryTrackId, secondaryTrackId, tabInfo, uploadedSubtitles]);

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
    const draft = createDraft(subtitle);
    if (!draft) return;

    const saved = findSavedSubtitleCard(savedSubtitles, draft);
    if (saved) {
      await deleteSubtitle(saved.id);
    } else {
      await saveSubtitle(draft);
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

const loadSubtitleTrack = async (
  id: SubtitleTrackId,
  tabInfo: ReturnType<typeof useTabStore.getState>['tabInfo'],
  uploadedSubtitles: ReturnType<typeof useUploadedSubtitles>['subtitles']
): Promise<SubtitleTrackSnapshot> => {
  if (isDefaultSubtitleLanguage(id)) {
    const subtitles = tabInfo?.[id] ?? [];
    return { id, language: id, subtitles: subtitles.map(stripSubtitleTags) };
  }

  const metadata = uploadedSubtitles.find((subtitle) => subtitle.id === id);
  const delay = metadata?.delay ?? 0;
  const subtitles = (await getLocalSubtitle(id)) ?? [];
  return {
    id,
    language: metadata?.language,
    subtitles: subtitles.map(({ text, start, end }) => ({ text: stripTags(text), start: start + delay, end: end + delay })),
  };
};

const stripSubtitleTags = ({ text, start, end }: SubtitleData): SubtitleData => ({
  text: stripTags(text),
  start,
  end,
});
