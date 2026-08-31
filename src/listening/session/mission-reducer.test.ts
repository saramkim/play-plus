import { describe, expect, expectTypeOf, it } from 'vitest';

import type {
  ListeningSegmentKey,
  ListeningSourceKey,
} from '@/listening/domain/source-identity';
import type {
  CommitProgressResult,
  DifficultSaveResult,
  EndSessionResult,
  ListeningMissionController,
  ListeningTerminalReason,
  PlaySegmentResult,
} from '@/listening/session/mission-controller';
import {
  createListeningMissionProgressResult,
  createListeningMissionState,
  listeningMissionReducer,
  selectListeningMissionView,
  type ListeningMissionAction,
  type ListeningMissionSnapshot,
  type ListeningMissionState,
} from '@/listening/session/mission-reducer';

const SOURCE_KEY = 'native:en' as ListeningSourceKey;
const PRACTICED_AT = '2026-08-09T12:00:00+12:00';

describe('Listening Mission controller contract', () => {
  it('keeps the shared terminal, playback, commit, end, and method unions exact', () => {
    expectTypeOf<ListeningTerminalReason>().toEqualTypeOf<
      'stale' | 'no-video' | 'segment-unavailable'
    >();
    expectTypeOf<PlaySegmentResult>().toEqualTypeOf<
      | { status: 'played' }
      | { status: ListeningTerminalReason | 'error' | 'suspended' }
    >();
    expectTypeOf<CommitProgressResult>().toEqualTypeOf<
      { status: 'saved' } | { status: 'error' }
    >();
    expectTypeOf<EndSessionResult>().toEqualTypeOf<
      | { status: 'ended' | 'already-ended' }
      | { status: 'stale' | 'no-video' | 'error' }
    >();
    expectTypeOf<Parameters<ListeningMissionController['playSegment']>[1]>().toEqualTypeOf<
      1 | 0.75
    >();
    expectTypeOf<Parameters<ListeningMissionController['endSession']>[0]>().toEqualTypeOf<
      'restore-start' | 'complete-stay' | 'continue-watching'
    >();
    expectTypeOf<DifficultSaveResult['retryableFailures'][number]['reason']>().toEqualTypeOf<
      'busy' | 'error'
    >();
  });
});

describe('Listening Mission snapshot', () => {
  it.each([1, 4, 10])('accepts and freezes an ordered %i-line snapshot', (count) => {
    const input = snapshot(count, { support: true });
    const state = createListeningMissionState(input);
    const view = selectListeningMissionView(state);

    expect(view).toMatchObject({
      activeIndex: 0,
      activeRound: 'first',
      phase: 'first-round',
      roundPosition: 1,
      roundTotal: count,
    });
    expect(Object.isFrozen(state.snapshot)).toBe(true);
    expect(Object.isFrozen(state.snapshot.segments)).toBe(true);
    expect(Object.isFrozen(state.snapshot.segments[0])).toBe(true);
    expect(Object.isFrozen(state.snapshot.segments[0].sourceIndices)).toBe(true);
    expect(Object.isFrozen(state.snapshot.segments[0].alignedSupport)).toBe(true);
    expect(state.snapshot).not.toBe(input);
  });

  it('clones the snapshot so later caller mutation cannot replace mission truth', () => {
    const input = snapshot(1, { support: true }) as {
      learningLanguage: string;
      segmenterVersion: 1;
      segments: Array<{
        alignedSupport?: { sourceIndices: number[]; text: string };
        answerText: string;
        segmentKey: ListeningSegmentKey;
        sourceIndices: number[];
        sourceKey: ListeningSourceKey;
      }>;
      sourceKey: ListeningSourceKey;
      videoId: string;
    };
    const state = createListeningMissionState(input);

    input.segments[0].answerText = 'Changed outside';
    input.segments[0].sourceIndices[0] = 99;
    input.segments[0].alignedSupport!.text = '바뀜';

    expect(state.snapshot.segments[0]).toMatchObject({
      answerText: 'Answer 1',
      sourceIndices: [0],
      alignedSupport: { text: '도움 1' },
    });
  });

  it('rejects zero, over-limit, duplicate, unordered, and cross-source segments', () => {
    expect(() => createListeningMissionState(snapshot(0))).toThrow(/between 1 and 10/u);
    expect(() => createListeningMissionState(snapshot(11))).toThrow(/between 1 and 10/u);

    const duplicate = snapshot(2);
    expect(() =>
      createListeningMissionState({
        ...duplicate,
        segments: [duplicate.segments[0], { ...duplicate.segments[1], segmentKey: key(0) }],
      })
    ).toThrow(/distinct/u);

    const unordered = snapshot(2);
    expect(() =>
      createListeningMissionState({
        ...unordered,
        segments: [
          { ...unordered.segments[0], sourceIndices: [2] },
          { ...unordered.segments[1], sourceIndices: [1] },
        ],
      })
    ).toThrow(/source order/u);

    const wrongSource = snapshot(1);
    expect(() =>
      createListeningMissionState({
        ...wrongSource,
        segments: [
          {
            ...wrongSource.segments[0],
            sourceKey: 'native:ko' as ListeningSourceKey,
          },
        ],
      })
    ).toThrow(/snapshot source/u);
  });

  it('rejects invalid language, segment content, source indices, and support', () => {
    const base = snapshot(1);
    expect(() => createListeningMissionState({ ...base, learningLanguage: ' ' })).toThrow(
      /learning language/u
    );
    expect(() =>
      createListeningMissionState({
        ...base,
        segments: [{ ...base.segments[0], answerText: ' ' }],
      })
    ).toThrow(/answer/u);
    expect(() =>
      createListeningMissionState({
        ...base,
        segments: [{ ...base.segments[0], sourceIndices: [1, 1] }],
      })
    ).toThrow(/distinct and ordered/u);
    expect(() =>
      createListeningMissionState({
        ...base,
        segments: [
          {
            ...base.segments[0],
            alignedSupport: { sourceIndices: [0], text: ' ' },
          },
        ],
      })
    ).toThrow(/support text/u);
  });
});

describe('Listening Mission first round', () => {
  it('keeps an incorrect draft editable and counts repeated submissions only when resolved', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(state, { type: 'update-draft', draft: 'Goodbye' }, { type: 'submit-answer' });

    expect(selectListeningMissionView(state)).toMatchObject({
      draft: 'Goodbye',
      judgment: 'try-again',
      currentCombo: 0,
      answerVisible: false,
    });
    expect(state.records[key(0)]).toMatchObject({
      completedSubmittedAttemptCount: 0,
      firstSubmission: 'non-exact',
      firstRoundVisitCompleted: false,
      submittedAttemptCount: 1,
    });
    expect(createListeningMissionProgressResult(state, PRACTICED_AT)).toBeUndefined();

    state = reduce(
      state,
      { type: 'update-draft', draft: 'Answer 2' },
      { type: 'submit-answer' }
    );
    expect(selectListeningMissionView(state)).toMatchObject({
      draft: 'Answer 2',
      judgment: 'almost',
    });
    expect(state.records[key(0)].submittedAttemptCount).toBe(2);

    state = answerCurrent(state);
    expect(selectListeningMissionView(state)).toMatchObject({
      answerVisible: true,
      draft: '',
      judgment: 'correct',
      lineState: 'correct',
    });
    expect(state.records[key(0)]).toMatchObject({
      completedSubmittedAttemptCount: 3,
      exactAfterFirstSubmission: true,
      firstSubmission: 'non-exact',
      firstRoundVisitCompleted: true,
      submittedAttemptCount: 3,
    });
  });

  it('keeps one submitted-answer scaffold fixed while editing and recomputes it only on submit', () => {
    const base = snapshot(1);
    let state = createListeningMissionState({
      ...base,
      segments: [{ ...base.segments[0], answerText: 'we really like tea' }],
    });
    state = reduce(
      state,
      { type: 'update-draft', draft: 'we realy like tea' },
      { type: 'submit-answer' }
    );
    const firstScaffold = state.submittedAnswerScaffold;
    if (!firstScaffold) throw new Error('Expected a submitted-answer scaffold');

    expect(selectListeningMissionView(state)).toMatchObject({
      draft: 'we realy like tea',
      judgment: 'almost',
      submittedAnswerScaffold: firstScaffold,
      submittedAnswerScaffoldRevision: 1,
    });
    expect(firstScaffold).toMatchObject({ strategy: 'token-lcs' });
    expect(state).toMatchObject({ activeHintStep: 0, currentCombo: 0 });
    expect(state.records[key(0)]).toMatchObject({
      highestTextHintLevel: 0,
      usedTextHint: false,
    });

    state = reduce(state, { type: 'update-draft', draft: 'we really like' });
    expect(state.draft).toBe('we really like');
    expect(state.submittedAnswerScaffold).toBe(firstScaffold);

    state = reduce(state, { type: 'submit-answer' });
    expect(state.submittedAnswerScaffold).not.toBe(firstScaffold);
    expect(state.submittedAnswerScaffold?.visualText).not.toBe(firstScaffold.visualText);
    expect(selectListeningMissionView(state).submittedAnswerScaffoldRevision).toBe(2);
    expect(state.records[key(0)]).toMatchObject({
      highestTextHintLevel: 0,
      submittedAttemptCount: 2,
      usedTextHint: false,
    });
  });

  it('clears the submitted-answer scaffold at every answer lifecycle boundary', () => {
    const makeSubmitted = () =>
      reduce(
        createListeningMissionState(snapshot(2)),
        { type: 'update-draft', draft: 'wrong' },
        { type: 'submit-answer' }
      );

    let exact = makeSubmitted();
    exact = answerCurrent(exact);
    expect(exact.submittedAnswerScaffold).toBeUndefined();

    let revealed = makeSubmitted();
    revealed = revealCurrent(revealed);
    expect(revealed.submittedAnswerScaffold).toBeUndefined();

    let later = makeSubmitted();
    later = reduce(later, { type: 'later' });
    expect(later.submittedAnswerScaffold).toBeUndefined();

    let roundEnd = reduce(
      createListeningMissionState(snapshot(1)),
      { type: 'update-draft', draft: 'wrong' },
      { type: 'submit-answer' },
      { type: 'later' }
    );
    expect(roundEnd.phase).toBe('first-round-summary');
    expect(roundEnd.submittedAnswerScaffold).toBeUndefined();
    roundEnd = reduce(roundEnd, { type: 'view-results' });
    expect(roundEnd.phase).toBe('results');
    expect(roundEnd.submittedAnswerScaffold).toBeUndefined();

    let nextLine = makeSubmitted();
    nextLine = answerCurrent(nextLine);
    nextLine = reduce(nextLine, { type: 'next-line' });
    expect(nextLine.submittedAnswerScaffold).toBeUndefined();

    let terminal = makeSubmitted();
    terminal = reduce(terminal, { type: 'invalidate', reason: 'stale' });
    expect(terminal.submittedAnswerScaffold).toBeUndefined();

    let contextChanged = makeSubmitted();
    contextChanged = reduce(contextChanged, {
      type: 'submitted-answer-scaffold-cleared',
    });
    expect(contextChanged.submittedAnswerScaffold).toBeUndefined();
  });

  it('preserves the scaffold through explicit non-Reveal hints and exit cancellation', () => {
    let state = reduce(
      createListeningMissionState(snapshot(1)),
      { type: 'update-draft', draft: 'wrong' },
      { type: 'submit-answer' }
    );
    const scaffold = state.submittedAnswerScaffold;
    state = reduce(
      state,
      { type: 'use-next-hint' },
      { type: 'open-exit' },
      { type: 'continue-mission' }
    );

    expect(state.submittedAnswerScaffold).toBe(scaffold);
    expect(state.records[key(0)]).toMatchObject({
      highestTextHintLevel: 1,
      usedTextHint: true,
    });
  });

  it('increments combo only for a hint-free exact first submission and keeps the best', () => {
    let state = createListeningMissionState(snapshot(4));
    state = answerCurrent(state);
    expect(state).toMatchObject({ currentCombo: 1, bestCombo: 1 });
    state = reduce(state, { type: 'next-line' });
    state = answerCurrent(state);
    expect(state).toMatchObject({ currentCombo: 2, bestCombo: 2 });
    state = reduce(state, { type: 'next-line' }, { type: 'use-next-hint' });
    expect(state).toMatchObject({ currentCombo: 0, bestCombo: 2 });
    state = answerCurrent(state);
    expect(state).toMatchObject({ currentCombo: 0, bestCombo: 2 });
    state = reduce(state, { type: 'next-line' });
    state = answerCurrent(state);
    expect(state).toMatchObject({ currentCombo: 1, bestCombo: 2 });
  });

  it('uses the exact support hint sequence and reveals without an attempt', () => {
    let state = createListeningMissionState(snapshot(1, { support: true }));
    let view = selectListeningMissionView(state);
    expect(view.nextHint?.level).toBe(1);

    state = reduce(state, { type: 'use-next-hint' });
    state = reduce(state, { type: 'use-next-hint' });
    state = reduce(state, { type: 'use-next-hint' });
    view = selectListeningMissionView(state);
    expect(view.openedHints.map(({ level }) => level)).toEqual([1, 2, 3]);
    expect(view.openedHints[2].text).toBe('도움 1');
    expect(view.nextHint?.level).toBe(4);

    state = reduce(state, { type: 'use-next-hint' });
    view = selectListeningMissionView(state);
    expect(view).toMatchObject({ answerVisible: true, lineState: 'revealed' });
    expect(view.openedHints.map(({ level }) => level)).toEqual([1, 2, 3, 4]);
    expect(state.records[key(0)]).toMatchObject({
      completedSubmittedAttemptCount: 0,
      firstRoundVisitCompleted: true,
      highestTextHintLevel: 3,
      submittedAttemptCount: 0,
      usedReveal: true,
      usedTextHint: true,
    });
    expect(createListeningMissionProgressResult(state, PRACTICED_AT)?.items).toEqual([
      {
        achievedState: 'attempted',
        segmentKey: key(0),
        submittedAttemptIncrement: 0,
      },
    ]);
  });

  it('skips support when unavailable and goes from first graphemes to Reveal', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(state, { type: 'use-next-hint' }, { type: 'use-next-hint' });
    const view = selectListeningMissionView(state);

    expect(view.openedHints.map(({ level }) => level)).toEqual([1, 2]);
    expect(view.nextHint?.level).toBe(4);
  });

  it('records Later as a completed zero-attempt visit and advances immediately', () => {
    let state = createListeningMissionState(snapshot(2));
    state = reduce(state, { type: 'later' });

    expect(selectListeningMissionView(state)).toMatchObject({
      activeIndex: 1,
      activeRound: 'first',
      completedVisitCount: 1,
      currentCombo: 0,
    });
    expect(createListeningMissionProgressResult(state, PRACTICED_AT)?.items).toEqual([
      {
        achievedState: 'attempted',
        segmentKey: key(0),
        submittedAttemptIncrement: 0,
      },
    ]);
  });

  it.each([1, 4, 10])(
    'visits %i lines once in source order and reaches Perfect Results',
    (count) => {
      const state = finishAllExact(snapshot(count));
      const view = selectListeningMissionView(state);

      expect(view.phase).toBe('results');
      expect(view.result).toMatchObject({
        clearedCount: count,
        firstSubmissionExactCount: count,
        masteredCount: count,
        perfect: true,
        segmentCount: count,
        stars: 3,
      });
      expect(state.snapshot.segments.map(({ segmentKey }) => segmentKey)).toEqual(
        Array.from({ length: count }, (_, index) => key(index))
      );
    }
  );

  it('waits for explicit Next after correct and Reveal', () => {
    let correct = answerCurrent(createListeningMissionState(snapshot(2)));
    expect(selectListeningMissionView(correct)).toMatchObject({
      activeIndex: 0,
      answerVisible: true,
    });
    correct = reduce(correct, { type: 'next-line' });
    expect(selectListeningMissionView(correct).activeIndex).toBe(1);

    let revealed = createListeningMissionState(snapshot(2));
    revealed = revealCurrent(revealed);
    expect(selectListeningMissionView(revealed)).toMatchObject({
      activeIndex: 0,
      answerVisible: true,
    });
    revealed = reduce(revealed, { type: 'next-line' });
    expect(selectListeningMissionView(revealed).activeIndex).toBe(1);
  });
});

describe('Listening Mission retry and Results', () => {
  it('offers one retry in original order, resets line text, and never recurses', () => {
    let state = createListeningMissionState(snapshot(4));
    state = reduce(state, { type: 'later' });
    state = reduce(
      state,
      { type: 'update-draft', draft: 'wrong' },
      { type: 'submit-answer' }
    );
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' }, { type: 'use-next-hint' });
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' });
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' });

    expect(state.phase).toBe('first-round-summary');
    expect(state.retrySegmentKeys).toEqual([key(0), key(1), key(2)]);
    expect(selectListeningMissionView(state).summary).toMatchObject({
      firstSubmissionExactCount: 2,
      retryCandidateCount: 3,
    });

    state = reduce(state, { type: 'start-retry' });
    expect(selectListeningMissionView(state)).toMatchObject({
      activeLineId: `retry:0:${key(0)}`,
      activeRound: 'retry',
      currentCombo: 0,
      draft: '',
      openedHints: [],
      roundTotal: 3,
    });

    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' });
    state = reduce(
      state,
      { type: 'update-draft', draft: 'wrong' },
      { type: 'submit-answer' },
      { type: 'later' }
    );
    state = reduce(state, { type: 'later' });

    const view = selectListeningMissionView(state);
    expect(view.phase).toBe('results');
    expect(view).toMatchObject({ retryAttemptedCount: 3, retrySuccessCount: 1 });
    expect(view.difficultCandidates.map(({ segmentKey }) => segmentKey)).toEqual([
      key(0),
      key(1),
      key(2),
    ]);
    expect(reduce(state, { type: 'start-retry' })).toBe(state);
  });

  it('View results skips retry without changing unresolved outcomes', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(state, { type: 'later' });
    expect(state.phase).toBe('first-round-summary');
    state = reduce(state, { type: 'view-results' });

    expect(selectListeningMissionView(state)).toMatchObject({
      phase: 'results',
      retryAttemptedCount: 0,
      retryCandidateCount: 1,
      retrySuccessCount: 0,
      result: { clearedCount: 0, stars: 1 },
    });
  });

  it('excludes an unfinished retry submission from completed progress', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(state, { type: 'later' }, { type: 'start-retry' });
    state = reduce(
      state,
      { type: 'update-draft', draft: 'unfinished retry' },
      { type: 'submit-answer' }
    );

    expect(state.records[key(0)]).toMatchObject({
      completedSubmittedAttemptCount: 0,
      submittedAttemptCount: 1,
    });
    expect(createListeningMissionProgressResult(state, PRACTICED_AT)?.items[0]).toEqual({
      achievedState: 'attempted',
      segmentKey: key(0),
      submittedAttemptIncrement: 0,
    });
  });

  it('preserves only completed first-round attempts during an unfinished retry', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(
      state,
      { type: 'update-draft', draft: 'wrong' },
      { type: 'submit-answer' }
    );
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' }, { type: 'start-retry' });
    state = reduce(
      state,
      { type: 'update-draft', draft: 'unfinished retry' },
      { type: 'submit-answer' }
    );

    expect(state.records[key(0)]).toMatchObject({
      completedSubmittedAttemptCount: 2,
      submittedAttemptCount: 3,
    });
    expect(
      createListeningMissionProgressResult(state, PRACTICED_AT)?.items[0]
        .submittedAttemptIncrement
    ).toBe(2);
  });

  it('awards 1, 2, and 3 stars at the #63 boundaries', () => {
    let oneStar = createListeningMissionState(snapshot(1));
    oneStar = reduce(oneStar, { type: 'later' }, { type: 'view-results' });
    expect(selectListeningMissionView(oneStar).result.stars).toBe(1);

    const twoStars = finishWithFirstExactCount(10, 7);
    expect(selectListeningMissionView(twoStars).result).toMatchObject({
      clearedCount: 10,
      firstSubmissionExactCount: 7,
      stars: 2,
    });

    const threeStars = finishWithFirstExactCount(10, 8);
    expect(selectListeningMissionView(threeStars).result).toMatchObject({
      clearedCount: 10,
      firstSubmissionExactCount: 8,
      stars: 3,
    });
  });

  it('allows three stars with a text hint but reserves Perfect and mastery', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(state, { type: 'use-next-hint' });
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' }, { type: 'view-results' });
    const view = selectListeningMissionView(state);

    expect(view.result).toMatchObject({
      firstSubmissionExactCount: 1,
      masteredCount: 0,
      perfect: false,
      stars: 3,
    });
    expect(view.difficultCandidates.map(({ segmentKey }) => segmentKey)).toEqual([key(0)]);
  });

  it('blocks three stars after Reveal', () => {
    let state = createListeningMissionState(snapshot(1));
    state = revealCurrent(state);
    state = reduce(state, { type: 'next-line' }, { type: 'view-results' });
    expect(selectListeningMissionView(state).result).toMatchObject({
      clearedCount: 0,
      perfect: false,
      stars: 1,
    });
  });
});

describe('Listening Mission progress and privacy', () => {
  it('builds a strict source-ordered whitelist from completed visits only', () => {
    let state = createListeningMissionState(snapshot(3));
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' }, { type: 'later' });
    state = reduce(
      state,
      { type: 'update-draft', draft: 'PRIVATE-TYPED-SENTINEL' },
      { type: 'submit-answer' }
    );
    expect(state.submittedAnswerScaffold).toBeDefined();

    const result = createListeningMissionProgressResult(state, PRACTICED_AT);
    expect(result).toEqual({
      bestCombo: 1,
      items: [
        {
          achievedState: 'mastered',
          segmentKey: key(0),
          submittedAttemptIncrement: 1,
        },
        {
          achievedState: 'attempted',
          segmentKey: key(1),
          submittedAttemptIncrement: 0,
        },
      ],
      learningSourceKey: SOURCE_KEY,
      practicedAt: PRACTICED_AT,
      segmenterVersion: 1,
      videoId: '123e4567-e89b-12d3-a456-426614174010',
    });
    expect(Object.keys(result!)).toEqual([
      'videoId',
      'learningSourceKey',
      'segmenterVersion',
      'practicedAt',
      'bestCombo',
      'items',
    ]);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-TYPED-SENTINEL');
    expect(JSON.stringify(result)).not.toContain('answerText');
    expect(JSON.stringify(result)).not.toContain('submittedAnswerScaffold');
    expect(JSON.stringify(result)).not.toContain('support');
  });

  it('returns no payload before a visit completes and rejects an invalid timestamp', () => {
    const empty = createListeningMissionState(snapshot(1));
    expect(createListeningMissionProgressResult(empty, PRACTICED_AT)).toBeUndefined();

    const completed = answerCurrent(empty);
    expect(() => createListeningMissionProgressResult(completed, '2026-08-09')).toThrow();
  });

  it('deep-freezes the validated payload against injected controller mutation', () => {
    const payload = createListeningMissionProgressResult(
      answerCurrent(createListeningMissionState(snapshot(1))),
      PRACTICED_AT
    );
    if (payload === undefined) throw new Error('Expected completed progress');

    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.items)).toBe(true);
    expect(Object.isFrozen(payload.items[0])).toBe(true);
    expect(Reflect.set(payload, 'bestCombo', 99)).toBe(false);
    expect(Reflect.set(payload.items[0], 'submittedAttemptIncrement', 99)).toBe(false);
    expect(() => payload.items.push({ ...payload.items[0] })).toThrow(TypeError);
    expect(payload).toMatchObject({
      bestCombo: 1,
      items: [{ submittedAttemptIncrement: 1 }],
    });
  });

  it('hides active truth during exit and restores the exact draft and hint state', () => {
    let state = createListeningMissionState(snapshot(1));
    state = reduce(
      state,
      { type: 'update-draft', draft: 'transient draft' },
      { type: 'use-next-hint' }
    );
    const before = selectListeningMissionView(state);
    state = reduce(state, { type: 'open-exit' });
    const exit = selectListeningMissionView(state);

    expect(exit).toMatchObject({
      activeLineId: before.activeLineId,
      activeRound: 'first',
      activeIndex: 0,
      phase: 'exit-confirmation',
    });
    expect(exit.activeSegment).toBe(before.activeSegment);

    state = reduce(state, { type: 'continue-mission' });
    const restored = selectListeningMissionView(state);
    expect(restored).toMatchObject({
      activeLineId: before.activeLineId,
      activeRound: 'first',
      draft: 'transient draft',
      phase: 'first-round',
    });
    expect(restored.openedHints).toEqual(before.openedHints);
  });

  it('purges draft, answer, and support on terminal invalidation but preserves progress facts', () => {
    const canonicalAnswer = 'CANONICAL-ANSWER-SENTINEL';
    const support = 'SUPPORT-SENTINEL';
    const base = snapshot(2, { support: true });
    let state = createListeningMissionState({
      ...base,
      segments: [
        {
          ...base.segments[0],
          alignedSupport: { sourceIndices: [20], text: support },
          answerText: canonicalAnswer,
        },
        base.segments[1],
      ],
    });
    state = reduce(
      state,
      { type: 'update-draft', draft: canonicalAnswer },
      { type: 'submit-answer' },
      { type: 'next-line' },
      { type: 'update-draft', draft: 'PRIVATE-DRAFT-SENTINEL' },
      { type: 'invalidate', reason: 'stale' }
    );

    const serialized = JSON.stringify(state);
    expect(selectListeningMissionView(state)).toMatchObject({
      activeLineId: '',
      activeRound: null,
      phase: 'terminal-invalidation',
      terminalReason: 'stale',
    });
    expect(serialized).not.toContain(canonicalAnswer);
    expect(serialized).not.toContain(support);
    expect(serialized).not.toContain('PRIVATE-DRAFT-SENTINEL');
    expect(state.snapshot.segments.every(({ answerText }) => answerText === '')).toBe(true);
    expect(createListeningMissionProgressResult(state, PRACTICED_AT)?.items).toEqual([
      {
        achievedState: 'mastered',
        segmentKey: key(0),
        submittedAttemptIncrement: 1,
      },
    ]);
  });

  it('guards progress completion, retry, terminal failure, and duplicate saved commits', () => {
    let state = finishAllExact(snapshot(1));
    expect(reduce(state, { type: 'progress-saved' })).toBe(state);
    expect(reduce(state, { type: 'progress-save-failed', origin: 'results' })).toBe(state);

    state = reduce(state, { type: 'progress-save-started', origin: 'results' });
    const pending = state;
    expect(reduce(state, { type: 'progress-save-started', origin: 'results' })).toBe(state);
    state = reduce(state, { type: 'progress-save-failed', origin: 'results' });
    expect(state).toMatchObject({
      phase: 'progress-save-failure',
      progressSaveStatus: 'error',
    });
    expect(reduce(pending, { type: 'progress-saved' })).toMatchObject({
      phase: 'results',
      progressSaveStatus: 'saved',
    });

    state = reduce(state, { type: 'progress-save-started', origin: 'results' });
    state = reduce(state, { type: 'progress-saved' });
    expect(state).toMatchObject({ phase: 'results', progressSaveStatus: 'saved' });
    expect(reduce(state, { type: 'progress-save-started', origin: 'results' })).toBe(state);

    let terminal = reduce(
      answerCurrent(createListeningMissionState(snapshot(1))),
      { type: 'invalidate', reason: 'no-video' },
      { type: 'progress-save-started', origin: 'mid-mission' },
      { type: 'progress-save-failed', origin: 'mid-mission' }
    );
    expect(terminal).toMatchObject({
      phase: 'terminal-invalidation',
      progressSaveStatus: 'error',
    });
    terminal = reduce(
      terminal,
      { type: 'progress-save-started', origin: 'mid-mission' },
      { type: 'progress-saved' }
    );
    expect(terminal).toMatchObject({
      phase: 'terminal-invalidation',
      progressSaveStatus: 'saved',
    });
  });
});

describe('Listening Mission difficult selection', () => {
  it('starts unchecked and applies only a pending, selected-key result', () => {
    let state = resultsWithLaterCandidates(2);
    let view = selectListeningMissionView(state);
    expect(view.difficultCandidates).toHaveLength(2);
    expect(view.difficultCandidates.every(({ selected }) => !selected)).toBe(true);
    expect(view.selectedDifficultSegmentKeys).toEqual([]);

    const late = reduce(state, {
      type: 'apply-difficult-save-result',
      result: { saved: [key(0)], retryableFailures: [] },
    });
    expect(late).toBe(state);

    state = reduce(state, { type: 'toggle-difficult', segmentKey: key(0) });
    state = reduce(state, { type: 'difficult-save-started' });
    state = reduce(state, {
      type: 'apply-difficult-save-result',
      result: {
        saved: [key(1)],
        retryableFailures: [{ segmentKey: key(0), reason: 'busy' }],
      },
    });
    view = selectListeningMissionView(state);

    expect(state.savedDifficultSegmentKeys).toEqual([]);
    expect(view.selectedDifficultSegmentKeys).toEqual([key(0)]);
    expect(view.difficultCandidates[0].retryableFailure).toBe('busy');
  });

  it('preserves partial successes, leaves retryable failures selected, and permits repeat save', () => {
    let state = resultsWithLaterCandidates(2);
    state = reduce(
      state,
      { type: 'toggle-difficult', segmentKey: key(0) },
      { type: 'toggle-difficult', segmentKey: key(1) },
      { type: 'difficult-save-started' },
      {
        type: 'apply-difficult-save-result',
        result: {
          saved: [key(0)],
          retryableFailures: [{ segmentKey: key(1), reason: 'error' }],
        },
      }
    );

    expect(state.savedDifficultSegmentKeys).toEqual([key(0)]);
    expect(state.selectedDifficultSegmentKeys).toEqual([key(1)]);
    expect(selectListeningMissionView(state).difficultCandidates).toEqual([
      expect.objectContaining({ saved: true, segmentKey: key(0), selected: false }),
      expect.objectContaining({ retryableFailure: 'error', segmentKey: key(1), selected: true }),
    ]);

    state = reduce(
      state,
      { type: 'toggle-difficult', segmentKey: key(0) },
      { type: 'difficult-save-started' },
      {
        type: 'apply-difficult-save-result',
        result: { saved: [key(0), key(1)], retryableFailures: [] },
      }
    );
    expect(state.savedDifficultSegmentKeys).toEqual([key(0), key(1)]);
    expect(state.selectedDifficultSegmentKeys).toEqual([]);
  });

  it('preserves successful keys and truthfully filters terminal unattempted keys', () => {
    let state = resultsWithLaterCandidates(3);
    state = reduce(
      state,
      { type: 'toggle-difficult', segmentKey: key(0) },
      { type: 'toggle-difficult', segmentKey: key(1) },
      { type: 'toggle-difficult', segmentKey: key(2) },
      { type: 'difficult-save-started' },
      {
        type: 'apply-difficult-save-result',
        result: {
          saved: [key(0)],
          retryableFailures: [],
          terminalFailure: {
            segmentKey: key(1),
            reason: 'segment-unavailable',
            unattempted: [key(2), key(99)],
          },
        },
      }
    );

    expect(state).toMatchObject({
      difficultTerminalFailure: {
        segmentKey: key(1),
        reason: 'segment-unavailable',
        unattempted: [key(2)],
      },
      phase: 'terminal-invalidation',
      savedDifficultSegmentKeys: [key(0)],
      selectedDifficultSegmentKeys: [],
      terminalReason: 'segment-unavailable',
    });
  });
});

const key = (index: number): ListeningSegmentKey =>
  `segment-v1-${index.toString(16).padStart(64, '0')}` as ListeningSegmentKey;

const snapshot = (
  count: number,
  options: { support?: boolean } = {}
): ListeningMissionSnapshot => ({
  learningLanguage: 'en',
  segmenterVersion: 1,
  segments: Array.from({ length: count }, (_, index) => ({
    ...(options.support
      ? {
          alignedSupport: {
            sourceIndices: [index + 100],
            text: `도움 ${index + 1}`,
          },
        }
      : {}),
    answerText: `Answer ${index + 1}`,
    segmentKey: key(index),
    sourceIndices: [index],
    sourceKey: SOURCE_KEY,
  })),
  sourceKey: SOURCE_KEY,
  videoId: '123e4567-e89b-12d3-a456-426614174010',
});

const reduce = (
  state: ListeningMissionState,
  ...actions: ListeningMissionAction[]
): ListeningMissionState => actions.reduce(listeningMissionReducer, state);

const answerCurrent = (state: ListeningMissionState): ListeningMissionState => {
  const segment = state.snapshot.segments.find(
    ({ segmentKey }) => segmentKey === state.activeSegmentKey
  );
  if (segment === undefined) throw new Error('Expected an active segment');
  return reduce(
    state,
    { type: 'update-draft', draft: segment.answerText },
    { type: 'submit-answer' }
  );
};

const revealCurrent = (state: ListeningMissionState): ListeningMissionState => {
  let next = state;
  while (selectListeningMissionView(next).nextHint?.level !== 4) {
    next = reduce(next, { type: 'use-next-hint' });
  }
  return reduce(next, { type: 'use-next-hint' });
};

const finishAllExact = (input: ListeningMissionSnapshot): ListeningMissionState => {
  let state = createListeningMissionState(input);
  for (let index = 0; index < input.segments.length; index += 1) {
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' });
  }
  return state;
};

const finishWithFirstExactCount = (
  count: number,
  firstExactCount: number
): ListeningMissionState => {
  let state = createListeningMissionState(snapshot(count));
  for (let index = 0; index < count; index += 1) {
    if (index >= firstExactCount) {
      state = reduce(
        state,
        { type: 'update-draft', draft: 'wrong' },
        { type: 'submit-answer' }
      );
    }
    state = answerCurrent(state);
    state = reduce(state, { type: 'next-line' });
  }
  return state.phase === 'first-round-summary'
    ? reduce(state, { type: 'view-results' })
    : state;
};

const resultsWithLaterCandidates = (count: number): ListeningMissionState => {
  let state = createListeningMissionState(snapshot(count, { support: true }));
  for (let index = 0; index < count; index += 1) {
    state = reduce(state, { type: 'later' });
  }
  return reduce(state, { type: 'view-results' });
};
