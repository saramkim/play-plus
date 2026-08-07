import type {
  ContentVideoIdentity,
  SubtitleOverviewCue,
  SubtitleRole,
} from '@utils/message/type';

export type SubtitleOverviewMode = 'together' | SubtitleRole;

export type SubtitleOverviewAlignedSupport = {
  sourceIndices: number[];
  text: string;
};

export type SubtitleOverviewLearningCue = SubtitleOverviewCue & {
  alignedSupport?: SubtitleOverviewAlignedSupport;
};

export type SubtitleOverviewTracksLike = {
  learning: { cues: SubtitleOverviewLearningCue[] };
  support: { cues: SubtitleOverviewCue[] } | null;
};

export type SubtitleOverviewRow = {
  alignedSupport?: SubtitleOverviewAlignedSupport;
  anchorRole: SubtitleRole;
  cue: SubtitleOverviewCue;
  key: string;
  learningSourceIndex?: number;
};

export const createSubtitleOverviewRows = (
  tracks: SubtitleOverviewTracksLike,
  mode: SubtitleOverviewMode
): SubtitleOverviewRow[] => {
  if (mode === 'support') {
    return (tracks.support?.cues ?? []).map((cue) => ({
      anchorRole: 'support',
      cue,
      key: `support:${cue.sourceIndex}`,
    }));
  }

  return tracks.learning.cues.map(({ alignedSupport, ...cue }) => ({
    ...(mode === 'together' && alignedSupport ? { alignedSupport } : {}),
    anchorRole: 'learning',
    cue,
    key: `learning:${cue.sourceIndex}`,
    learningSourceIndex: cue.sourceIndex,
  }));
};

export const filterSubtitleOverviewRows = (
  rows: SubtitleOverviewRow[],
  searchText: string
) => {
  const query = searchText.trim().toLowerCase();

  return rows.filter((row) => {
    const visibleTexts = [row.cue.text, row.alignedSupport?.text]
      .filter((text): text is string => typeof text === 'string')
      .map((text) => text.trim())
      .filter(Boolean);

    return (
      visibleTexts.length > 0 &&
      (query === '' || visibleTexts.some((text) => text.toLowerCase().includes(query)))
    );
  });
};

export const findActiveSubtitleOverviewRow = (
  rows: SubtitleOverviewRow[],
  currentTime: number
) => {
  const activeCue = findActiveSubtitleOverviewCue(
    rows.map(({ cue }) => cue),
    currentTime
  );

  return activeCue ? rows.find(({ cue }) => cue === activeCue) : undefined;
};

export const getSubtitleOverviewRowTimeRange = (rows: SubtitleOverviewRow[]) =>
  getSubtitleOverviewTimeRange(rows.map(({ cue }) => cue));

export const filterSubtitleOverviewCues = (
  cues: SubtitleOverviewCue[],
  searchText: string
) => {
  const query = searchText.trim().toLowerCase();

  return cues.filter(({ text }) => {
    const normalizedText = text.trim();
    if (normalizedText === '') return false;
    return query === '' || normalizedText.toLowerCase().includes(query);
  });
};

export const findActiveSubtitleOverviewCue = (
  cues: SubtitleOverviewCue[],
  currentTime: number
) => {
  const currentTimeMs = toMilliseconds(currentTime);

  return cues.reduce<SubtitleOverviewCue | undefined>((activeCue, cue) => {
    if (cue.text.trim() === '') return activeCue;

    const startTimeMs = toMilliseconds(cue.startTime);
    const endTimeMs = toMilliseconds(cue.endTime);
    if (currentTimeMs < startTimeMs || currentTimeMs > endTimeMs) return activeCue;
    if (!activeCue) return cue;

    const activeStartTimeMs = toMilliseconds(activeCue.startTime);
    if (startTimeMs > activeStartTimeMs) return cue;
    if (startTimeMs === activeStartTimeMs && cue.sourceIndex < activeCue.sourceIndex) return cue;
    return activeCue;
  }, undefined);
};

export const getSubtitleOverviewTimeRange = (cues: SubtitleOverviewCue[]) => {
  if (cues.length === 0) return undefined;

  return cues.reduce(
    (range, cue) => ({
      endTime: Math.max(range.endTime, cue.endTime),
      startTime: Math.min(range.startTime, cue.startTime),
    }),
    { endTime: cues[0].endTime, startTime: cues[0].startTime }
  );
};

export const isSameContentVideoIdentity = (
  left: ContentVideoIdentity,
  right: ContentVideoIdentity
) =>
  left.contentInstanceId === right.contentInstanceId &&
  left.routeChangedAt === right.routeChangedAt &&
  left.videoId === right.videoId &&
  left.videoRevision === right.videoRevision;

const toMilliseconds = (seconds: number) => Math.round(seconds * 1000);
