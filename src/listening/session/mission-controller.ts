import type { ListeningMissionResult } from '@storage/v2/listening-progress-storage';

export type ListeningMissionProgressResult = ListeningMissionResult;

export type ListeningTerminalReason = 'stale' | 'no-video' | 'segment-unavailable';

export type PlaySegmentResult =
  | { status: 'played' }
  | { status: ListeningTerminalReason | 'error' | 'suspended' };

export type CommitProgressResult = { status: 'saved' } | { status: 'error' };

export type EndSessionResult =
  | { status: 'ended' | 'already-ended' }
  | { status: 'stale' | 'no-video' | 'error' };

export type DifficultSaveResult = {
  saved: string[];
  retryableFailures: Array<{
    segmentKey: string;
    reason: 'busy' | 'error';
  }>;
  terminalFailure?: {
    segmentKey: string;
    reason: ListeningTerminalReason;
    unattempted: string[];
  };
};

export type ListeningMissionController = {
  playSegment: (
    segmentKey: string,
    rate: 1 | 0.75
  ) => Promise<PlaySegmentResult>;
  commitProgress: (
    result: ListeningMissionProgressResult
  ) => Promise<CommitProgressResult>;
  endSession: (
    mode: 'restore-start' | 'complete-stay' | 'continue-watching'
  ) => Promise<EndSessionResult>;
  saveDifficultSegments: (segmentKeys: string[]) => Promise<DifficultSaveResult>;
};
