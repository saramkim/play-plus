import {
  listeningMissionResultSchema,
  type ListeningMissionResult,
} from '@storage/v2/listening-progress-storage';

import { judgeListeningAnswer, type ListeningAnswerJudgment } from '@/listening/domain/answer';
import {
  createListeningHintSequence,
  type ListeningHint,
} from '@/listening/domain/hint';
import {
  calculateListeningMissionResult,
  createListeningSegmentOutcome,
  type ListeningFirstSubmission,
  type ListeningMissionResult as ListeningMissionScore,
  type ListeningRetryResult,
  type ListeningSegmentEvidence,
} from '@/listening/domain/result';
import {
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
  type ListeningSegmentKey,
  type ListeningSourceKey,
} from '@/listening/domain/source-identity';

import type {
  DifficultSaveResult,
  ListeningMissionProgressResult,
  ListeningTerminalReason,
} from './mission-controller';

export type ListeningMissionSegment = Readonly<{
  alignedSupport?: Readonly<{
    sourceIndices: readonly number[];
    text: string;
  }>;
  answerText: string;
  segmentKey: ListeningSegmentKey;
  sourceIndices: readonly number[];
  sourceKey: ListeningSourceKey;
}>;

export type ListeningMissionSnapshot = Readonly<{
  learningLanguage: string;
  segmenterVersion: 1;
  segments: readonly ListeningMissionSegment[];
  sourceKey: ListeningSourceKey;
  videoId: string;
}>;

export type ListeningMissionPhase =
  | 'first-round'
  | 'first-round-summary'
  | 'retry-round'
  | 'results'
  | 'exit-confirmation'
  | 'progress-save-failure'
  | 'terminal-invalidation';

export type ListeningMissionRound = 'first' | 'retry';
export type ListeningMissionLineState = 'answering' | 'correct' | 'revealed';
export type ListeningMissionProgressSaveStatus = 'idle' | 'pending' | 'saved' | 'error';
export type ListeningMissionDifficultSaveStatus = 'idle' | 'pending';
export type ListeningTextHintLevel = 0 | 1 | 2 | 3;

export type ListeningMissionSegmentRecord = Readonly<{
  completedSubmittedAttemptCount: number;
  exactAfterFirstSubmission: boolean;
  firstRoundVisitCompleted: boolean;
  firstSubmission: ListeningFirstSubmission;
  highestTextHintLevel: ListeningTextHintLevel;
  retryResult: ListeningRetryResult;
  submittedAttemptCount: number;
  usedLater: boolean;
  usedReveal: boolean;
  usedTextHint: boolean;
}>;

export type ListeningMissionProgressSaveOrigin = 'mid-mission' | 'results';

export type ListeningMissionState = Readonly<{
  activeHintStep: number;
  activeSegmentKey?: ListeningSegmentKey;
  bestCombo: number;
  currentCombo: number;
  difficultRetryableFailures: readonly Readonly<{
    reason: 'busy' | 'error';
    segmentKey: string;
  }>[];
  difficultSaveStatus: ListeningMissionDifficultSaveStatus;
  difficultTerminalFailure?: DifficultSaveResult['terminalFailure'];
  draft: string;
  exitReturnPhase?: Exclude<
    ListeningMissionPhase,
    'exit-confirmation' | 'progress-save-failure' | 'terminal-invalidation'
  >;
  judgment?: ListeningAnswerJudgment;
  lineState: ListeningMissionLineState;
  phase: ListeningMissionPhase;
  progressFailureReturnPhase?: 'results' | 'exit-confirmation';
  progressSaveOrigin?: ListeningMissionProgressSaveOrigin;
  progressSaveStatus: ListeningMissionProgressSaveStatus;
  records: Readonly<Record<ListeningSegmentKey, ListeningMissionSegmentRecord>>;
  retrySegmentKeys: readonly ListeningSegmentKey[];
  round: ListeningMissionRound | null;
  roundIndex: number;
  savedDifficultSegmentKeys: readonly ListeningSegmentKey[];
  selectedDifficultSegmentKeys: readonly ListeningSegmentKey[];
  snapshot: ListeningMissionSnapshot;
  terminalReason?: ListeningTerminalReason;
}>;

export type ListeningMissionAction =
  | { type: 'draft-updated'; draft: string }
  | { type: 'update-draft'; draft: string }
  | { type: 'answer-submitted' }
  | { type: 'submit-answer' }
  | { type: 'hint-requested' }
  | { type: 'use-next-hint' }
  | { type: 'later-chosen' }
  | { type: 'later' }
  | { type: 'next-chosen' }
  | { type: 'next-line' }
  | { type: 'retry-started' }
  | { type: 'start-retry' }
  | { type: 'results-requested' }
  | { type: 'view-results' }
  | { type: 'exit-opened' }
  | { type: 'open-exit' }
  | { type: 'exit-cancelled' }
  | { type: 'continue-mission' }
  | {
      type: 'progress-save-started';
      origin: ListeningMissionProgressSaveOrigin;
    }
  | { type: 'progress-save-succeeded' }
  | { type: 'progress-saved' }
  | {
      type: 'progress-save-failed';
      origin?: 'mid-mission' | 'results';
    }
  | { type: 'difficult-selection-toggled'; segmentKey: string }
  | { type: 'toggle-difficult'; segmentKey: string }
  | { type: 'difficult-save-started' }
  | { type: 'difficult-save-completed'; result: DifficultSaveResult }
  | { type: 'apply-difficult-save-result'; result: DifficultSaveResult }
  | { type: 'terminal-received'; reason: ListeningTerminalReason }
  | { type: 'invalidate'; reason: ListeningTerminalReason };

export type ListeningMissionFirstRoundSummary = Readonly<{
  bestCombo: number;
  firstSubmissionExactCount: number;
  retryCandidateCount: number;
}>;

export type ListeningMissionResults = ListeningMissionScore &
  Readonly<{
    bestCombo: number;
    hintFreeCorrectCount: number;
    retryAttemptedCount: number;
    retrySuccessCount: number;
  }>;

export type ListeningMissionDifficultCandidate = Readonly<{
  answerText: string;
  retryableFailure?: 'busy' | 'error';
  saved: boolean;
  segment: ListeningMissionSegment;
  segmentKey: ListeningSegmentKey;
  selected: boolean;
  supportText?: string;
}>;

export type ListeningMissionView = Readonly<{
  activeIndex: number;
  activeLineId: string;
  activeRound: ListeningMissionRound | null;
  activeSegment?: ListeningMissionSegment;
  answerVisible: boolean;
  bestCombo: number;
  completedVisitCount: number;
  currentCombo: number;
  currentHint?: ListeningHint;
  difficultCandidates: readonly ListeningMissionDifficultCandidate[];
  draft: string;
  firstSubmissionExactCount: number;
  hintFreeCorrectCount: number;
  judgment?: ListeningAnswerJudgment;
  lineState: ListeningMissionLineState;
  nextHint?: ListeningHint;
  openedHints: readonly ListeningHint[];
  phase: ListeningMissionPhase;
  progressSaveStatus: ListeningMissionProgressSaveStatus;
  result: ListeningMissionResults;
  retryAttemptedCount: number;
  retryCandidateCount: number;
  retrySuccessCount: number;
  round: ListeningMissionRound | null;
  roundPosition: number;
  roundTotal: number;
  selectedDifficultSegmentKeys: readonly ListeningSegmentKey[];
  summary?: ListeningMissionFirstRoundSummary;
  terminalReason?: ListeningTerminalReason;
}>;

const MAX_MISSION_SEGMENTS = 10;

export const createListeningMissionState = (
  input: ListeningMissionSnapshot
): ListeningMissionState => {
  const snapshot = createImmutableSnapshot(input);
  const records = Object.fromEntries(
    snapshot.segments.map(({ segmentKey }) => [segmentKey, createEmptySegmentRecord()])
  ) as Record<ListeningSegmentKey, ListeningMissionSegmentRecord>;

  return {
    activeHintStep: 0,
    activeSegmentKey: snapshot.segments[0].segmentKey,
    bestCombo: 0,
    currentCombo: 0,
    difficultRetryableFailures: [],
    difficultSaveStatus: 'idle',
    draft: '',
    lineState: 'answering',
    phase: 'first-round',
    progressSaveStatus: 'idle',
    records,
    retrySegmentKeys: [],
    round: 'first',
    roundIndex: 0,
    savedDifficultSegmentKeys: [],
    selectedDifficultSegmentKeys: [],
    snapshot,
  };
};

export const listeningMissionReducer = (
  state: ListeningMissionState,
  action: ListeningMissionAction
): ListeningMissionState => {
  switch (action.type) {
    case 'draft-updated':
    case 'update-draft':
      return updateDraft(state, action.draft);
    case 'answer-submitted':
    case 'submit-answer':
      return submitAnswer(state);
    case 'hint-requested':
    case 'use-next-hint':
      return requestHint(state);
    case 'later-chosen':
    case 'later':
      return chooseLater(state);
    case 'next-chosen':
    case 'next-line':
      return chooseNext(state);
    case 'retry-started':
    case 'start-retry':
      return startRetry(state);
    case 'results-requested':
    case 'view-results':
      return viewResults(state);
    case 'exit-opened':
    case 'open-exit':
      return openExitConfirmation(state);
    case 'exit-cancelled':
    case 'continue-mission':
      return cancelExitConfirmation(state);
    case 'progress-save-started':
      return startProgressSave(state, action.origin);
    case 'progress-save-succeeded':
    case 'progress-saved':
      return finishProgressSave(state);
    case 'progress-save-failed':
      return failProgressSave(state, action.origin);
    case 'difficult-selection-toggled':
    case 'toggle-difficult':
      return toggleDifficultSelection(state, action.segmentKey);
    case 'difficult-save-started':
      return startDifficultSave(state);
    case 'difficult-save-completed':
    case 'apply-difficult-save-result':
      return finishDifficultSave(state, action.result);
    case 'terminal-received':
    case 'invalidate':
      return invalidateSession(state, action.reason);
  }
};

export const selectListeningMissionView = (
  state: ListeningMissionState
): ListeningMissionView => {
  const activeSegment = isActiveViewContext(state) ? getActiveSegment(state) : undefined;
  const activeRound = activeSegment === undefined ? null : state.round;
  const hints = activeSegment === undefined ? [] : getHintSequence(state, activeSegment);
  const currentHint = state.activeHintStep === 0 ? undefined : hints[state.activeHintStep - 1];
  const nextHint =
    state.lineState === 'answering' ? hints[state.activeHintStep] : undefined;
  const completedVisitCount = getCompletedSegments(state).length;
  const firstRoundCompleted = completedVisitCount === state.snapshot.segments.length;
  const score = calculateListeningMissionResult(
    state.snapshot.segments.map(({ segmentKey }) => toEvidence(state.records[segmentKey])),
    firstRoundCompleted
  );
  const results = createResults(state, score);
  const resultsContext = isResultsContext(state);

  return {
    activeIndex:
      activeSegment === undefined
        ? -1
        : state.snapshot.segments.findIndex(
            ({ segmentKey }) => segmentKey === activeSegment.segmentKey
          ),
    activeLineId:
      activeSegment === undefined || activeRound === null
        ? ''
        : `${activeRound}:${state.roundIndex}:${activeSegment.segmentKey}`,
    ...(activeSegment === undefined
      ? {}
      : {
          activeSegment,
        }),
    activeRound,
    answerVisible: state.lineState !== 'answering',
    bestCombo: state.bestCombo,
    completedVisitCount,
    currentCombo: state.currentCombo,
    ...(currentHint === undefined ? {} : { currentHint }),
    difficultCandidates: resultsContext
      ? getDifficultCandidates(state)
      : [],
    draft: state.draft,
    firstSubmissionExactCount: score.firstSubmissionExactCount,
    hintFreeCorrectCount: results.hintFreeCorrectCount,
    ...(state.judgment === undefined ? {} : { judgment: state.judgment }),
    lineState: state.lineState,
    ...(nextHint === undefined ? {} : { nextHint }),
    openedHints: hints.slice(0, state.activeHintStep),
    phase: state.phase,
    progressSaveStatus: state.progressSaveStatus,
    result: results,
    retryAttemptedCount: results.retryAttemptedCount,
    retryCandidateCount: state.retrySegmentKeys.length,
    retrySuccessCount: results.retrySuccessCount,
    round: state.round,
    roundPosition: activeSegment === undefined ? 0 : state.roundIndex + 1,
    roundTotal:
      state.round === 'retry'
        ? state.retrySegmentKeys.length
        : state.snapshot.segments.length,
    selectedDifficultSegmentKeys: state.selectedDifficultSegmentKeys,
    ...(isSummaryContext(state)
      ? {
          summary: {
            bestCombo: state.bestCombo,
            firstSubmissionExactCount: score.firstSubmissionExactCount,
            retryCandidateCount: state.retrySegmentKeys.length,
          },
        }
      : {}),
    ...(state.terminalReason === undefined ? {} : { terminalReason: state.terminalReason }),
  };
};

export const createListeningMissionProgressResult = (
  state: ListeningMissionState,
  practicedAt: string
): ListeningMissionProgressResult | undefined => {
  const items = getCompletedSegments(state).map(({ segmentKey }) => {
    const record = state.records[segmentKey];
    return {
      achievedState: createListeningSegmentOutcome(toEvidence(record)).state,
      segmentKey,
      submittedAttemptIncrement: record.completedSubmittedAttemptCount,
    };
  });

  if (items.length === 0) return undefined;

  const result: ListeningMissionResult = {
    bestCombo: state.bestCombo,
    items,
    learningSourceKey: state.snapshot.sourceKey,
    practicedAt,
    segmenterVersion: state.snapshot.segmenterVersion,
    videoId: state.snapshot.videoId,
  };

  const parsedResult = listeningMissionResultSchema.parse(result);
  parsedResult.items.forEach((item) => Object.freeze(item));
  Object.freeze(parsedResult.items);
  Object.freeze(parsedResult);
  return parsedResult;
};

const updateDraft = (state: ListeningMissionState, draft: string): ListeningMissionState => {
  if (!isActiveAnsweringLine(state)) return state;
  return { ...state, draft };
};

const submitAnswer = (state: ListeningMissionState): ListeningMissionState => {
  const segment = getActiveSegment(state);
  if (segment === undefined || !isActiveAnsweringLine(state)) return state;

  const judgment = judgeListeningAnswer(
    segment.answerText,
    state.draft,
    state.snapshot.learningLanguage
  );
  const record = state.records[segment.segmentKey];
  const submittedAttemptCount = record.submittedAttemptCount + 1;

  if (judgment !== 'correct') {
    const updatedRecord: ListeningMissionSegmentRecord = {
      ...record,
      ...(state.round === 'first' && record.firstSubmission === 'none'
        ? { firstSubmission: 'non-exact' as const }
        : {}),
      submittedAttemptCount,
    };

    return {
      ...state,
      currentCombo: 0,
      judgment,
      records: replaceRecord(state, segment.segmentKey, updatedRecord),
    };
  }

  const firstExactSubmission =
    state.round === 'first' && record.firstSubmission === 'none';
  const earnsCombo = firstExactSubmission && !record.usedTextHint && !record.usedReveal;
  const currentCombo = earnsCombo ? state.currentCombo + 1 : state.currentCombo;
  const updatedRecord: ListeningMissionSegmentRecord = {
    ...record,
    completedSubmittedAttemptCount: submittedAttemptCount,
    exactAfterFirstSubmission:
      record.exactAfterFirstSubmission ||
      (state.round === 'first' && record.firstSubmission === 'non-exact'),
    firstRoundVisitCompleted:
      record.firstRoundVisitCompleted || state.round === 'first',
    firstSubmission: firstExactSubmission ? 'exact' : record.firstSubmission,
    retryResult: state.round === 'retry' ? 'exact' : record.retryResult,
    submittedAttemptCount,
  };

  return {
    ...state,
    bestCombo: Math.max(state.bestCombo, currentCombo),
    currentCombo,
    draft: '',
    judgment,
    lineState: 'correct',
    records: replaceRecord(state, segment.segmentKey, updatedRecord),
  };
};

const requestHint = (state: ListeningMissionState): ListeningMissionState => {
  const segment = getActiveSegment(state);
  if (segment === undefined || !isActiveAnsweringLine(state)) return state;

  const hints = getHintSequence(state, segment);
  const hint = hints[state.activeHintStep];
  if (hint === undefined) return state;

  const record = state.records[segment.segmentKey];
  if (hint.level === 4) {
    const updatedRecord = completeRecordVisit(
      {
        ...record,
        usedReveal: true,
      },
      state.round,
      'failed'
    );

    return {
      ...state,
      activeHintStep: state.activeHintStep + 1,
      currentCombo: 0,
      draft: '',
      judgment: undefined,
      lineState: 'revealed',
      records: replaceRecord(state, segment.segmentKey, updatedRecord),
    };
  }

  const updatedRecord: ListeningMissionSegmentRecord = {
    ...record,
    highestTextHintLevel: Math.max(
      record.highestTextHintLevel,
      hint.level
    ) as ListeningTextHintLevel,
    usedTextHint: true,
  };

  return {
    ...state,
    activeHintStep: state.activeHintStep + 1,
    currentCombo: 0,
    records: replaceRecord(state, segment.segmentKey, updatedRecord),
  };
};

const chooseLater = (state: ListeningMissionState): ListeningMissionState => {
  const segment = getActiveSegment(state);
  if (segment === undefined || !isActiveAnsweringLine(state)) return state;

  const record = state.records[segment.segmentKey];
  const updatedRecord = completeRecordVisit(
    { ...record, usedLater: true },
    state.round,
    'failed'
  );
  const updatedState: ListeningMissionState = {
    ...state,
    currentCombo: 0,
    records: replaceRecord(state, segment.segmentKey, updatedRecord),
  };

  return advanceToNextLine(updatedState);
};

const chooseNext = (state: ListeningMissionState): ListeningMissionState => {
  if (getActiveSegment(state) === undefined || state.lineState === 'answering') return state;
  return advanceToNextLine(state);
};

const startRetry = (state: ListeningMissionState): ListeningMissionState => {
  if (state.phase !== 'first-round-summary' || state.retrySegmentKeys.length === 0) return state;
  return resetActiveLine({
    ...state,
    activeSegmentKey: state.retrySegmentKeys[0],
    currentCombo: 0,
    phase: 'retry-round',
    round: 'retry',
    roundIndex: 0,
  });
};

const viewResults = (state: ListeningMissionState): ListeningMissionState => {
  if (state.phase !== 'first-round-summary') return state;
  return clearActiveLine({ ...state, phase: 'results' });
};

const openExitConfirmation = (state: ListeningMissionState): ListeningMissionState => {
  if (
    state.phase === 'exit-confirmation' ||
    state.phase === 'progress-save-failure' ||
    state.phase === 'terminal-invalidation'
  ) {
    return state;
  }

  return { ...state, exitReturnPhase: state.phase, phase: 'exit-confirmation' };
};

const cancelExitConfirmation = (state: ListeningMissionState): ListeningMissionState => {
  if (state.phase !== 'exit-confirmation' || state.exitReturnPhase === undefined) return state;
  const { exitReturnPhase, ...rest } = state;
  return { ...rest, phase: exitReturnPhase };
};

const startProgressSave = (
  state: ListeningMissionState,
  origin: ListeningMissionProgressSaveOrigin
): ListeningMissionState => {
  if (state.progressSaveStatus === 'pending' || state.progressSaveStatus === 'saved') return state;
  return {
    ...state,
    progressSaveOrigin: origin,
    progressSaveStatus: 'pending',
  };
};

const finishProgressSave = (state: ListeningMissionState): ListeningMissionState => {
  if (state.progressSaveStatus !== 'pending') return state;
  const returnPhase = state.progressFailureReturnPhase;
  return {
    ...state,
    phase: state.phase === 'progress-save-failure' && returnPhase ? returnPhase : state.phase,
    progressFailureReturnPhase: undefined,
    progressSaveStatus: 'saved',
  };
};

const failProgressSave = (
  state: ListeningMissionState,
  origin?: 'mid-mission' | 'results'
): ListeningMissionState => {
  if (state.progressSaveStatus !== 'pending') return state;
  if (state.phase === 'terminal-invalidation') {
    return { ...state, progressSaveStatus: 'error' };
  }
  const returnPhase =
    state.phase === 'exit-confirmation' ||
    state.progressSaveOrigin === 'mid-mission' ||
    origin === 'mid-mission'
      ? 'exit-confirmation'
      : 'results';
  return {
    ...state,
    phase: 'progress-save-failure',
    progressFailureReturnPhase: returnPhase,
    progressSaveStatus: 'error',
  };
};

const toggleDifficultSelection = (
  state: ListeningMissionState,
  segmentKey: string
): ListeningMissionState => {
  if (state.difficultSaveStatus === 'pending' || !isResultsContext(state)) return state;
  const candidateKeys = new Set(
    getDifficultCandidates(state).map(({ segment }) => segment.segmentKey)
  );
  const candidateKey = segmentKey as ListeningSegmentKey;
  if (!candidateKeys.has(candidateKey)) return state;

  const selected = new Set(state.selectedDifficultSegmentKeys);
  if (selected.has(candidateKey)) selected.delete(candidateKey);
  else selected.add(candidateKey);

  return {
    ...state,
    difficultRetryableFailures: state.difficultRetryableFailures.filter(
      (failure) => failure.segmentKey !== candidateKey
    ),
    selectedDifficultSegmentKeys: state.snapshot.segments
      .map(({ segmentKey: key }) => key)
      .filter((key) => selected.has(key)),
  };
};

const startDifficultSave = (state: ListeningMissionState): ListeningMissionState => {
  if (
    !isResultsContext(state) ||
    state.difficultSaveStatus === 'pending' ||
    state.selectedDifficultSegmentKeys.length === 0
  ) {
    return state;
  }

  return {
    ...state,
    difficultRetryableFailures: [],
    difficultSaveStatus: 'pending',
  };
};

const finishDifficultSave = (
  state: ListeningMissionState,
  result: DifficultSaveResult
): ListeningMissionState => {
  if (state.difficultSaveStatus !== 'pending') return state;

  const knownKeys = new Set(state.snapshot.segments.map(({ segmentKey }) => segmentKey));
  const requestedKeys = new Set(state.selectedDifficultSegmentKeys);
  const saved = result.saved.filter(
    (key): key is ListeningSegmentKey =>
      knownKeys.has(key as ListeningSegmentKey) && requestedKeys.has(key as ListeningSegmentKey)
  );
  const savedSet = new Set([...state.savedDifficultSegmentKeys, ...saved]);
  const retryableFailures = result.retryableFailures.filter(
    ({ segmentKey }) =>
      knownKeys.has(segmentKey as ListeningSegmentKey) &&
      requestedKeys.has(segmentKey as ListeningSegmentKey)
  );
  const retryableSet = new Set(retryableFailures.map(({ segmentKey }) => segmentKey));
  const selected = state.selectedDifficultSegmentKeys.filter(
    (segmentKey) => !savedSet.has(segmentKey) && retryableSet.has(segmentKey)
  );
  const nextState: ListeningMissionState = {
    ...state,
    difficultRetryableFailures: retryableFailures,
    difficultSaveStatus: 'idle',
    savedDifficultSegmentKeys: state.snapshot.segments
      .map(({ segmentKey }) => segmentKey)
      .filter((segmentKey) => savedSet.has(segmentKey)),
    selectedDifficultSegmentKeys: selected,
  };

  if (
    result.terminalFailure === undefined ||
    !requestedKeys.has(result.terminalFailure.segmentKey as ListeningSegmentKey)
  ) {
    return nextState;
  }

  const terminalFailure = {
    ...result.terminalFailure,
    unattempted: result.terminalFailure.unattempted.filter((segmentKey) =>
      requestedKeys.has(segmentKey as ListeningSegmentKey)
    ),
  };

  return {
    ...invalidateSession(nextState, terminalFailure.reason),
    difficultTerminalFailure: terminalFailure,
  };
};

const invalidateSession = (
  state: ListeningMissionState,
  reason: ListeningTerminalReason
): ListeningMissionState => {
  return {
    ...clearActiveLine({ ...state, snapshot: sanitizeSnapshot(state.snapshot) }),
    difficultSaveStatus: 'idle',
    phase: 'terminal-invalidation',
    selectedDifficultSegmentKeys: [],
    terminalReason: reason,
  };
};

const advanceToNextLine = (state: ListeningMissionState): ListeningMissionState => {
  if (state.round === 'first') {
    const nextIndex = state.roundIndex + 1;
    if (nextIndex < state.snapshot.segments.length) {
      return resetActiveLine({
        ...state,
        activeSegmentKey: state.snapshot.segments[nextIndex].segmentKey,
        roundIndex: nextIndex,
      });
    }

    const retrySegmentKeys = state.snapshot.segments
      .filter(({ segmentKey }) =>
        createListeningSegmentOutcome(toEvidence(state.records[segmentKey])).retryCandidate
      )
      .map(({ segmentKey }) => segmentKey);

    return clearActiveLine({
      ...state,
      phase: retrySegmentKeys.length > 0 ? 'first-round-summary' : 'results',
      retrySegmentKeys,
    });
  }

  if (state.round === 'retry') {
    const nextIndex = state.roundIndex + 1;
    if (nextIndex < state.retrySegmentKeys.length) {
      return resetActiveLine({
        ...state,
        activeSegmentKey: state.retrySegmentKeys[nextIndex],
        roundIndex: nextIndex,
      });
    }

    return clearActiveLine({ ...state, phase: 'results' });
  }

  return state;
};

const completeRecordVisit = (
  record: ListeningMissionSegmentRecord,
  round: ListeningMissionRound | null,
  retryResult: ListeningRetryResult
): ListeningMissionSegmentRecord => ({
  ...record,
  completedSubmittedAttemptCount: record.submittedAttemptCount,
  firstRoundVisitCompleted: record.firstRoundVisitCompleted || round === 'first',
  retryResult: round === 'retry' ? retryResult : record.retryResult,
});

const replaceRecord = (
  state: ListeningMissionState,
  segmentKey: ListeningSegmentKey,
  record: ListeningMissionSegmentRecord
): ListeningMissionState['records'] => ({
  ...state.records,
  [segmentKey]: record,
});

const resetActiveLine = (state: ListeningMissionState): ListeningMissionState => ({
  ...state,
  activeHintStep: 0,
  draft: '',
  judgment: undefined,
  lineState: 'answering',
});

const clearActiveLine = (state: ListeningMissionState): ListeningMissionState => ({
  ...resetActiveLine(state),
  activeSegmentKey: undefined,
  round: null,
  roundIndex: 0,
});

const isActiveAnsweringLine = (state: ListeningMissionState) =>
  (state.phase === 'first-round' || state.phase === 'retry-round') &&
  state.lineState === 'answering';

const getActiveSegment = (
  state: ListeningMissionState
): ListeningMissionSegment | undefined => {
  if (state.phase === 'terminal-invalidation' || state.activeSegmentKey === undefined) {
    return undefined;
  }
  return state.snapshot.segments.find(
    ({ segmentKey }) => segmentKey === state.activeSegmentKey
  );
};

const getHintSequence = (
  state: ListeningMissionState,
  segment: ListeningMissionSegment
) =>
  createListeningHintSequence({
    expected: segment.answerText,
    learningLanguage: state.snapshot.learningLanguage,
    ...(segment.alignedSupport === undefined
      ? {}
      : { support: segment.alignedSupport.text }),
  });

const getCompletedSegments = (state: ListeningMissionState) =>
  state.snapshot.segments.filter(
    ({ segmentKey }) => state.records[segmentKey].firstRoundVisitCompleted
  );

const getDifficultCandidates = (
  state: ListeningMissionState
): ListeningMissionDifficultCandidate[] => {
  const selected = new Set(state.selectedDifficultSegmentKeys);
  const saved = new Set(state.savedDifficultSegmentKeys);
  const failures = new Map(
    state.difficultRetryableFailures.map(({ reason, segmentKey }) => [segmentKey, reason])
  );

  return state.snapshot.segments.flatMap((segment) => {
    const outcome = createListeningSegmentOutcome(toEvidence(state.records[segment.segmentKey]));
    if (!outcome.difficult) return [];
    const retryableFailure = failures.get(segment.segmentKey);
    return [
      {
        answerText: segment.answerText,
        ...(retryableFailure === undefined ? {} : { retryableFailure }),
        saved: saved.has(segment.segmentKey),
        segment,
        segmentKey: segment.segmentKey,
        selected: selected.has(segment.segmentKey),
        ...(segment.alignedSupport === undefined
          ? {}
          : { supportText: segment.alignedSupport.text }),
      },
    ];
  });
};

const createResults = (
  state: ListeningMissionState,
  score: ListeningMissionScore
): ListeningMissionResults => {
  const outcomes = state.snapshot.segments.map(({ segmentKey }) => ({
    evidence: toEvidence(state.records[segmentKey]),
    outcome: createListeningSegmentOutcome(toEvidence(state.records[segmentKey])),
  }));

  return {
    ...score,
    bestCombo: state.bestCombo,
    hintFreeCorrectCount: outcomes.filter(
      ({ outcome }) => outcome.cleared && !outcome.usedAnyTextHint
    ).length,
    retryAttemptedCount: outcomes.filter(
      ({ evidence }) => evidence.retryResult !== 'not-attempted'
    ).length,
    retrySuccessCount: outcomes.filter(({ evidence }) => evidence.retryResult === 'exact')
      .length,
  };
};

const isSummaryContext = (state: ListeningMissionState) =>
  state.phase === 'first-round-summary' ||
  (state.phase === 'exit-confirmation' && state.exitReturnPhase === 'first-round-summary');

const isResultsContext = (state: ListeningMissionState) =>
  state.phase === 'results' ||
  (state.phase === 'exit-confirmation' && state.exitReturnPhase === 'results') ||
  (state.phase === 'progress-save-failure' && state.progressFailureReturnPhase === 'results');

const isActiveViewContext = (state: ListeningMissionState) =>
  state.phase === 'first-round' ||
  state.phase === 'retry-round' ||
  (state.phase === 'exit-confirmation' &&
    (state.exitReturnPhase === 'first-round' || state.exitReturnPhase === 'retry-round'));

const toEvidence = (record: ListeningMissionSegmentRecord): ListeningSegmentEvidence => ({
  exactAfterFirstSubmission: record.exactAfterFirstSubmission,
  firstSubmission: record.firstSubmission,
  retryResult: record.retryResult,
  usedLater: record.usedLater,
  usedReveal: record.usedReveal,
  usedTextHint: record.usedTextHint,
});

const createEmptySegmentRecord = (): ListeningMissionSegmentRecord => ({
  completedSubmittedAttemptCount: 0,
  exactAfterFirstSubmission: false,
  firstRoundVisitCompleted: false,
  firstSubmission: 'none',
  highestTextHintLevel: 0,
  retryResult: 'not-attempted',
  submittedAttemptCount: 0,
  usedLater: false,
  usedReveal: false,
  usedTextHint: false,
});

const createImmutableSnapshot = (
  snapshot: ListeningMissionSnapshot
): ListeningMissionSnapshot => {
  if (snapshot.videoId.length === 0) throw new Error('Mission video ID must not be empty');
  if (snapshot.learningLanguage.trim().length === 0) {
    throw new Error('Mission learning language must not be empty');
  }
  if (snapshot.segmenterVersion !== 1) {
    throw new Error('Mission segmenter version must be 1');
  }

  const sourceKey = listeningSourceKeySchema.parse(snapshot.sourceKey);
  if (snapshot.segments.length < 1 || snapshot.segments.length > MAX_MISSION_SEGMENTS) {
    throw new Error('Mission must contain between 1 and 10 segments');
  }

  const seenKeys = new Set<ListeningSegmentKey>();
  let previousSourceIndex = -1;
  const segments = snapshot.segments.map((segment): ListeningMissionSegment => {
    const segmentKey = listeningSegmentKeySchema.parse(segment.segmentKey);
    if (seenKeys.has(segmentKey)) throw new Error('Mission segment keys must be distinct');
    seenKeys.add(segmentKey);
    if (segment.sourceKey !== sourceKey) {
      throw new Error('Mission segments must belong to the snapshot source');
    }
    if (segment.answerText.trim().length === 0) {
      throw new Error('Mission segment answer must not be empty');
    }

    const sourceIndices = validateSourceIndices(segment.sourceIndices, 'Mission segment');
    if (sourceIndices[0] <= previousSourceIndex) {
      throw new Error('Mission segments must remain in distinct source order');
    }
    previousSourceIndex = sourceIndices.at(-1)!;

    const alignedSupport =
      segment.alignedSupport === undefined
        ? undefined
        : segment.alignedSupport.text.trim().length === 0
          ? (() => {
              throw new Error('Mission support text must not be empty');
            })()
          : Object.freeze({
            sourceIndices: validateSourceIndices(
              segment.alignedSupport.sourceIndices,
              'Mission support'
            ),
            text: segment.alignedSupport.text,
          });

    return Object.freeze({
      ...(alignedSupport === undefined ? {} : { alignedSupport }),
      answerText: segment.answerText,
      segmentKey,
      sourceIndices,
      sourceKey,
    });
  });

  return Object.freeze({
    learningLanguage: snapshot.learningLanguage,
    segmenterVersion: 1,
    segments: Object.freeze(segments),
    sourceKey,
    videoId: snapshot.videoId,
  });
};

const sanitizeSnapshot = (snapshot: ListeningMissionSnapshot): ListeningMissionSnapshot =>
  Object.freeze({
    ...snapshot,
    segments: Object.freeze(
      snapshot.segments.map((segment) =>
        Object.freeze({
          answerText: '',
          segmentKey: segment.segmentKey,
          sourceIndices: segment.sourceIndices,
          sourceKey: segment.sourceKey,
        })
      )
    ),
  });

const validateSourceIndices = (
  indices: readonly number[],
  label: string
): readonly number[] => {
  if (indices.length === 0) throw new Error(`${label} source indices must not be empty`);
  let previous = -1;
  for (const index of indices) {
    if (!Number.isSafeInteger(index) || index < 0 || index <= previous) {
      throw new Error(`${label} source indices must be distinct and ordered`);
    }
    previous = index;
  }
  return Object.freeze([...indices]);
};
