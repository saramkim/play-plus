import { useEffect, useMemo, useState } from 'react';

import { getLocalSubtitle } from '@storage/subtitle';
import { SubtitleMetadata } from '@storage/type';
import { LANGUAGES } from '@utils/constants';
import { stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { SubtitleData } from '@utils/parse';
import { toast } from 'sonner';

import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';
import { useTabStore } from '@/ui/store/tab-store';

const EMPTY_CUES: SubtitleData[] = [];

// Owned by the keyed Analysis view: primary source/tab/video changes reset this transient selection.
export function useAnalysisCompanion(primaryId: string, videoId: string | null) {
  const [selection, setSelection] = useState('');
  const tabInfo = useTabStore((state) => state.tabInfo);
  const { subtitles: uploaded } = useUploadedSubtitles();
  const nativeMatches = Boolean(videoId && tabInfo?.nativeVideoId === videoId);
  const options = useMemo(() => [
    ...(['en', 'ko'] as const).filter((id) => nativeMatches && tabInfo?.[id]?.length)
      .map((id) => ({ id, label: t(LANGUAGES[id]) })),
    ...uploaded.map(({ id, title, language }) => ({ id, label: `${title} (${t(LANGUAGES[language])})` })),
  ].filter(({ id }) => id !== primaryId), [nativeMatches, tabInfo, uploaded, primaryId]);
  const selectedId = options.some(({ id }) => id === selection) ? selection : '';
  const metadata = uploaded.find(({ id }) => id === selectedId);
  const [custom, setCustom] = useState<{ metadata: SubtitleMetadata; cues: SubtitleData[] } | null>(null);

  useEffect(() => { if (selection && !selectedId) setSelection(''); }, [selection, selectedId]);
  useEffect(() => {
    if (!metadata) return;
    let cancelled = false;
    let revision = 0;
    const read = async () => {
      const request = ++revision;
      setCustom(null);
      try {
        const cues = await getLocalSubtitle(metadata.id);
        if (cancelled || revision !== request) return;
        const delay = metadata.delay || 0;
        setCustom({ metadata, cues: cues.map(({ text, start, end }) => ({
          text: stripTags(text), start: start + delay, end: end + delay,
        })) });
      } catch {
        if (!cancelled && revision === request) toast.error(t('error_try_later'));
      }
    };
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (metadata.id in changes) void read();
    };
    chrome.storage.local.onChanged.addListener(onChanged);
    void read();
    return () => { cancelled = true; chrome.storage.local.onChanged.removeListener(onChanged); };
  }, [metadata]);

  const cues = useMemo(() => {
    if (selectedId === 'en' || selectedId === 'ko') {
      return (nativeMatches ? tabInfo?.[selectedId] ?? EMPTY_CUES : EMPTY_CUES)
        .map(({ text, start, end }) => ({ text: stripTags(text), start, end }));
    }
    return metadata && custom?.metadata === metadata ? custom.cues : EMPTY_CUES;
  }, [selectedId, nativeMatches, tabInfo, metadata, custom]);

  return { selectedId, setSelectedId: setSelection, options, cues };
}

// Called for mounted virtual rows only; source order and original cue objects are preserved.
export const findCompanionCues = (primary: SubtitleData, companions: SubtitleData[]) => companions.filter((cue) =>
  Math.min(primary.end, cue.end) > Math.max(primary.start, cue.start));
