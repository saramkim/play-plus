import { describe, expect, it } from 'vitest';

import {
  calculateListeningMissionResult,
  createListeningSegmentOutcome,
  ListeningSegmentEvidence,
} from './result';

describe('Listening Mission segment outcomes', () => {
  it('awards mastered only for an unassisted exact first submission', () => {
    expect(createListeningSegmentOutcome(evidence())).toMatchObject({
      state: 'mastered',
      cleared: true,
      mastered: true,
      retryCandidate: false,
      difficult: false,
    });
  });

  it('keeps later exact and retry exact at cleared without retroactive mastery', () => {
    expect(
      createListeningSegmentOutcome(
        evidence({ firstSubmission: 'non-exact', exactAfterFirstSubmission: true })
      )
    ).toMatchObject({ state: 'cleared', retryCandidate: true, difficult: true });

    expect(
      createListeningSegmentOutcome(
        evidence({ firstSubmission: 'non-exact', retryResult: 'exact' })
      )
    ).toMatchObject({ state: 'cleared', mastered: false, retryCandidate: true });
  });

  it.each([
    [{ usedTextHint: true }, true],
    [{ usedReveal: true }, true],
    [{ usedLater: true }, true],
    [{ retryResult: 'failed' as const }, false],
  ])('marks difficult evidence without storing answer text', (patch, retryCandidate) => {
    const outcome = createListeningSegmentOutcome(
      evidence({ firstSubmission: 'none', ...patch })
    );

    expect(outcome.difficult).toBe(true);
    expect(outcome.retryCandidate).toBe(retryCandidate);
    expect(outcome.state).toBe('attempted');
  });

  it('makes audio replay count irrelevant to mastery and result', () => {
    expect(createListeningSegmentOutcome(evidence({ audioReplayCount: 0 }))).toEqual(
      createListeningSegmentOutcome(evidence({ audioReplayCount: 99 }))
    );
  });
});

describe('Listening Mission result calculation', () => {
  it('awards zero before first-round completion and one star afterward', () => {
    const partial = [evidence(), evidence({ firstSubmission: 'none' })];

    expect(calculateListeningMissionResult(partial, false).stars).toBe(0);
    expect(calculateListeningMissionResult(partial, true).stars).toBe(1);
  });

  it('awards two stars when all segments clear below the 80 percent boundary', () => {
    const mission = [
      evidence(),
      evidence(),
      evidence(),
      evidence({ firstSubmission: 'non-exact', exactAfterFirstSubmission: true }),
      evidence({ firstSubmission: 'non-exact', retryResult: 'exact' }),
    ];

    expect(calculateListeningMissionResult(mission, true)).toMatchObject({
      stars: 2,
      perfect: false,
      clearedCount: 5,
      firstSubmissionExactCount: 3,
      retryCandidateCount: 2,
      difficultCount: 2,
    });
  });

  it('awards three stars at the inclusive 80 percent boundary without Reveal', () => {
    const mission = [
      evidence(),
      evidence(),
      evidence(),
      evidence(),
      evidence({ firstSubmission: 'non-exact', exactAfterFirstSubmission: true }),
    ];

    expect(calculateListeningMissionResult(mission, true)).toMatchObject({
      stars: 3,
      perfect: false,
      firstSubmissionExactCount: 4,
      firstSubmissionExactRate: 0.8,
    });
  });

  it('blocks three stars after Reveal even when every segment clears', () => {
    const mission = [
      evidence(),
      evidence(),
      evidence(),
      evidence(),
      evidence({ firstSubmission: 'none', usedReveal: true, retryResult: 'exact' }),
    ];

    expect(calculateListeningMissionResult(mission, true).stars).toBe(2);
  });

  it('requires every first submission exact and no text hint for Perfect', () => {
    const perfect = Array.from({ length: 5 }, () => evidence());
    const hinted = perfect.map((item, index) =>
      index === 0 ? evidence({ usedTextHint: true }) : item
    );
    const deferred = perfect.map((item, index) =>
      index === 0 ? evidence({ usedLater: true }) : item
    );

    expect(calculateListeningMissionResult(perfect, true)).toMatchObject({ stars: 3, perfect: true });
    expect(calculateListeningMissionResult(hinted, true)).toMatchObject({ stars: 3, perfect: false });
    expect(calculateListeningMissionResult(deferred, true).perfect).toBe(false);
  });

  it('does not award a result for an empty mission', () => {
    expect(calculateListeningMissionResult([], true)).toMatchObject({ stars: 0, perfect: false });
  });
});

const evidence = (patch: Partial<ListeningSegmentEvidence> = {}): ListeningSegmentEvidence => ({
  firstSubmission: 'exact',
  exactAfterFirstSubmission: false,
  usedTextHint: false,
  usedReveal: false,
  usedLater: false,
  retryResult: 'not-attempted',
  ...patch,
});
