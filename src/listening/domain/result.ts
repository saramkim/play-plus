export type ListeningFirstSubmission = 'exact' | 'non-exact' | 'none';
export type ListeningRetryResult = 'not-attempted' | 'exact' | 'failed';
export type ListeningOutcomeState = 'attempted' | 'cleared' | 'mastered';

export type ListeningSegmentEvidence = {
  firstSubmission: ListeningFirstSubmission;
  exactAfterFirstSubmission: boolean;
  usedTextHint: boolean;
  usedReveal: boolean;
  usedLater: boolean;
  retryResult: ListeningRetryResult;
  audioReplayCount?: number;
};

export type ListeningSegmentOutcome = {
  state: ListeningOutcomeState;
  cleared: boolean;
  mastered: boolean;
  firstSubmissionExact: boolean;
  retryCandidate: boolean;
  difficult: boolean;
  usedReveal: boolean;
  usedAnyTextHint: boolean;
};

export type ListeningMissionResult = {
  stars: 0 | 1 | 2 | 3;
  perfect: boolean;
  segmentCount: number;
  clearedCount: number;
  masteredCount: number;
  firstSubmissionExactCount: number;
  firstSubmissionExactRate: number;
  retryCandidateCount: number;
  difficultCount: number;
};

export const createListeningSegmentOutcome = (
  evidence: ListeningSegmentEvidence
): ListeningSegmentOutcome => {
  const retryCandidate = isListeningRetryCandidate(evidence);
  const firstSubmissionExact = evidence.firstSubmission === 'exact';
  const usedAnyTextHint = evidence.usedTextHint || evidence.usedReveal;
  const retried = evidence.retryResult !== 'not-attempted';
  const cleared =
    firstSubmissionExact ||
    evidence.exactAfterFirstSubmission ||
    evidence.retryResult === 'exact';
  const mastered = firstSubmissionExact && !retryCandidate && !retried;

  return {
    state: mastered ? 'mastered' : cleared ? 'cleared' : 'attempted',
    cleared,
    mastered,
    firstSubmissionExact,
    retryCandidate,
    difficult: isListeningDifficultCandidate(evidence),
    usedReveal: evidence.usedReveal,
    usedAnyTextHint,
  };
};

export const isListeningRetryCandidate = (evidence: ListeningSegmentEvidence): boolean => {
  return (
    evidence.firstSubmission === 'non-exact' ||
    evidence.usedTextHint ||
    evidence.usedReveal ||
    evidence.usedLater
  );
};

export const isListeningDifficultCandidate = (evidence: ListeningSegmentEvidence): boolean => {
  return isListeningRetryCandidate(evidence) || evidence.retryResult === 'failed';
};

export const calculateListeningMissionResult = (
  evidence: readonly ListeningSegmentEvidence[],
  firstRoundCompleted: boolean
): ListeningMissionResult => {
  const outcomes = evidence.map(createListeningSegmentOutcome);
  const segmentCount = outcomes.length;
  const clearedCount = outcomes.filter(({ cleared }) => cleared).length;
  const masteredCount = outcomes.filter(({ mastered }) => mastered).length;
  const firstSubmissionExactCount = outcomes.filter(({ firstSubmissionExact }) => firstSubmissionExact).length;
  const retryCandidateCount = outcomes.filter(({ retryCandidate }) => retryCandidate).length;
  const difficultCount = outcomes.filter(({ difficult }) => difficult).length;
  const firstSubmissionExactRate = segmentCount === 0 ? 0 : firstSubmissionExactCount / segmentCount;
  const allCleared = segmentCount > 0 && clearedCount === segmentCount;
  const hasReveal = outcomes.some(({ usedReveal }) => usedReveal);
  const perfect =
    firstRoundCompleted &&
    segmentCount > 0 &&
    outcomes.every(
      ({ firstSubmissionExact, retryCandidate, usedAnyTextHint }) =>
        firstSubmissionExact && !retryCandidate && !usedAnyTextHint
    );
  let stars: ListeningMissionResult['stars'] = 0;

  if (firstRoundCompleted && segmentCount > 0) stars = 1;
  if (firstRoundCompleted && allCleared) stars = 2;
  if (
    firstRoundCompleted &&
    allCleared &&
    firstSubmissionExactCount * 5 >= segmentCount * 4 &&
    !hasReveal
  ) {
    stars = 3;
  }

  return {
    stars,
    perfect,
    segmentCount,
    clearedCount,
    masteredCount,
    firstSubmissionExactCount,
    firstSubmissionExactRate,
    retryCandidateCount,
    difficultCount,
  };
};
