import type {
  ListeningSegmentKey,
  ListeningSourceKey,
} from '@/listening/domain/source-identity';

export type ListeningMissionSegment = Readonly<{
  alignedSupport?: Readonly<{ sourceIndices: readonly number[]; text: string }>;
  answerText: string;
  endMs: number;
  segmentKey: ListeningSegmentKey;
  sourceIndices: readonly number[];
  sourceKey: ListeningSourceKey;
  startMs: number;
}>;

export type ListeningMissionSnapshot = Readonly<{
  learningLanguage: string;
  segmenterVersion: 1;
  segments: readonly ListeningMissionSegment[];
  sourceKey: ListeningSourceKey;
  videoId: string;
}>;
