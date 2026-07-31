import { SavedSubtitleDraft, buildSavedSubtitleDraft } from '@storage/saved-subtitle';
import { SubtitleId } from '@storage/subtitle';
import { DefaultSubtitleLanguage, Language } from '@utils/constants';
import { findSubtitle, stripTags } from '@utils/helper';
import { SubtitleData } from '@utils/parse';

export type SubtitleTrackId = DefaultSubtitleLanguage | SubtitleId;

export interface SubtitleTrackSnapshot {
  id: SubtitleTrackId;
  language?: Language;
  subtitles: SubtitleData[];
}

interface BuildAnalysisSavedSubtitleDraftInput {
  selectedSubtitle: SubtitleData;
  selectedTrack: SubtitleTrackSnapshot;
  primaryTrack?: SubtitleTrackSnapshot;
  secondaryTrack?: SubtitleTrackSnapshot;
  url: string;
}

export const buildAnalysisSavedSubtitleDraft = ({
  selectedSubtitle,
  selectedTrack,
  primaryTrack,
  secondaryTrack,
  url,
}: BuildAnalysisSavedSubtitleDraftInput): SavedSubtitleDraft => {
  const isPrimary = selectedTrack.id === primaryTrack?.id;
  const isSecondary = selectedTrack.id === secondaryTrack?.id && !isPrimary;
  const primarySubtitle = isSecondary
    ? findSubtitle(primaryTrack?.subtitles ?? [], selectedSubtitle.start)
    : selectedSubtitle;
  const secondarySubtitle = isPrimary
    ? findSubtitle(secondaryTrack?.subtitles ?? [], selectedSubtitle.start)
    : isSecondary
      ? selectedSubtitle
      : undefined;

  return buildSavedSubtitleDraft({
    primary: toLine(primarySubtitle, primarySubtitle === selectedSubtitle ? selectedTrack.language : primaryTrack?.language),
    secondary: toLine(
      secondarySubtitle,
      secondarySubtitle === selectedSubtitle ? selectedTrack.language : secondaryTrack?.language
    ),
    url,
    startTime: primarySubtitle?.start ?? selectedSubtitle.start,
  });
};

const toLine = (subtitle?: SubtitleData, language?: Language) => {
  if (!subtitle) return undefined;

  const text = stripTags(subtitle.text);
  return text ? { text, language } : undefined;
};
