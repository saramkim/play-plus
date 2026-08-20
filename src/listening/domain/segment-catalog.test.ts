import type { V2SubtitleCue } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';

import {
  buildListeningSegmentCatalog,
  findListeningContinueSegment,
  findListeningSegmentContainingTime,
  findListeningStartSegment,
  findNextListeningSegmentInGap,
  selectListeningMissionSegments,
} from '@/listening/domain/segment-catalog';
import { createNativeListeningSourceKey } from '@/listening/domain/source-identity';

const sourceKey = createNativeListeningSourceKey('en');

describe('listening segment catalog', () => {
  it('continues greedily after reaching 800ms until a condition fails', async () => {
    const catalog = await build([
      cue(0, 0.799, 'Keep'),
      cue(0.8, 1.2, 'going.'),
      cue(1.201, 2.2, 'Next line'),
    ]);

    expect(catalog).toHaveLength(2);
    expect(catalog[0]).toMatchObject({
      answerText: 'Keep going.',
      cleanedTextParts: ['Keep', 'going.'],
      sourceIndices: [0, 1],
      startMs: 0,
      endMs: 1200,
    });
    expect(catalog[1].sourceIndices).toEqual([2]);
  });

  it('stops at completion punctuation and a dialogue-prefixed next cue', async () => {
    const punctuation = await build([
      cue(0, 0.999, 'Stop.'),
      cue(1, 1.999, 'Continue'),
    ]);
    const dialogue = await build([
      cue(0, 0.999, 'First speaker'),
      cue(1, 1.999, '— Second speaker'),
    ]);

    expect(punctuation.map(({ sourceIndices }) => sourceIndices)).toEqual([[0], [1]]);
    expect(dialogue.map(({ sourceIndices }) => sourceIndices)).toEqual([[0], [1]]);
  });

  it('treats every ineligible source cue as an immediate separator', async () => {
    const catalog = await build([
      cue(0, 0.999, 'First'),
      cue(1, 1.1, '♪ ♫'),
      cue(1.101, 2.1, 'Second'),
    ]);

    expect(catalog.map(({ sourceIndices }) => sourceIndices)).toEqual([[0], [2]]);
  });

  it('includes a 700ms uncovered gap and splits at 701ms', async () => {
    const allowed = await build([
      cue(0, 0.999, 'First'),
      cue(1.7, 2.5, 'Second'),
    ]);
    const rejected = await build([
      cue(0, 0.999, 'First'),
      cue(1.701, 2.5, 'Second'),
    ]);

    expect(allowed.map(({ sourceIndices }) => sourceIndices)).toEqual([[0, 1]]);
    expect(rejected.map(({ sourceIndices }) => sourceIndices)).toEqual([[0], [1]]);
  });

  it.each([
    { label: '799ms', end: 0.798, text: 'AB', included: false },
    { label: '800ms', end: 0.799, text: 'AB', included: true },
    { label: '9000ms', end: 8.999, text: 'AB', included: true },
    { label: '9001ms', end: 9, text: 'AB', included: false },
    { label: '1 grapheme', end: 0.799, text: 'A', included: false },
    { label: '2 graphemes', end: 0.799, text: 'AB', included: true },
    { label: '120 graphemes', end: 0.799, text: 'A'.repeat(120), included: true },
    { label: '121 graphemes', end: 0.799, text: 'A'.repeat(121), included: false },
  ])('enforces the inclusive segment boundary: $label', async ({ end, text, included }) => {
    const catalog = await build([cue(0, end, text)]);

    expect(catalog).toHaveLength(included ? 1 : 0);
  });

  it('omits an invalid consumed group without reconsidering or bridging its cues', async () => {
    const catalog = await build([
      cue(0, 0.1, 'A'),
      cue(0.101, 0.2, 'B.'),
      cue(0.201, 1.2, 'Later'),
    ]);

    expect(catalog.map(({ sourceIndices }) => sourceIndices)).toEqual([[2]]);
  });

  it('never splits an oversized source cue', async () => {
    const catalog = await build([cue(0, 9, 'A'.repeat(121))]);

    expect(catalog).toEqual([]);
  });

  it('omits a whole crossing segment without truncating it or its source cues', async () => {
    const catalog = await build(
      [
        cue(0, 0.999, 'Before.'),
        cue(2, 3.2, 'Crossing.'),
        cue(4, 4.999, 'Beyond.'),
      ],
      { fenceEndMs: 3000 }
    );

    expect(catalog.map(({ sourceIndices }) => sourceIndices)).toEqual([[0]]);
    expect(catalog[0]).toMatchObject({ startMs: 0, endMs: 999 });
  });

  it('cleans spoken parts once and keeps deterministic source order', async () => {
    const catalog = await build([
      cue(0, 0.4, '<i>Hello</i> [noise]'),
      cue(0.401, 1, '  brave\nworld.  '),
    ]);

    expect(catalog[0]).toMatchObject({
      answerText: 'Hello brave world.',
      cleanedTextParts: ['Hello', 'brave world.'],
      sourceIndices: [0, 1],
    });
  });

  it('applies learning delay once while keeping grouping and identity stable', async () => {
    const cues = [cue(0, 0.4, 'Hello'), cue(0.401, 1, 'world.')];
    const withoutDelay = await build(cues);
    const withDelay = await build(cues, { learningDelaySeconds: 2.5 });

    expect(withDelay[0].segmentKey).toBe(withoutDelay[0].segmentKey);
    expect(withDelay[0].sourceIndices).toEqual(withoutDelay[0].sourceIndices);
    expect(withDelay[0].startMs).toBe(withoutDelay[0].startMs + 2500);
    expect(withDelay[0].endMs).toBe(withoutDelay[0].endMs + 2500);
  });

  it('keeps grouping stable at rounding boundaries when only delay changes', async () => {
    const cues = [
      cue(0.0005, 0.9995, 'First'),
      cue(1.7005, 2.5005, 'Second'),
    ];
    const withoutDelay = await build(cues);
    const withDelay = await build(cues, { learningDelaySeconds: 0.0005 });

    expect(withDelay.map(({ sourceIndices }) => sourceIndices)).toEqual(
      withoutDelay.map(({ sourceIndices }) => sourceIndices)
    );
    expect(withDelay.map(({ segmentKey }) => segmentKey)).toEqual(
      withoutDelay.map(({ segmentKey }) => segmentKey)
    );
  });

  it('uses the existing support alignment policy once per emitted segment', async () => {
    const learningCues = [cue(0, 1, 'Learning line.')];
    const aligned = await build(learningCues, {
      supportCues: [cue(0, 1, '<i>도움 문장</i>')],
    });
    const unavailable = await build(learningCues, {
      supportCues: [cue(10, 11, 'Far away')],
    });

    expect(aligned[0].alignedSupport).toEqual({ sourceIndices: [0], text: '도움 문장' });
    expect(unavailable[0].alignedSupport).toBeUndefined();
    expect(unavailable[0].segmentKey).toBe(aligned[0].segmentKey);
  });

  it('keeps segment keys independent of support and both role delays', async () => {
    const learningCues = [cue(2, 3, 'Learning line.')];
    const first = await build(learningCues, {
      learningDelaySeconds: 1,
      supportCues: [cue(2, 3, 'Support')],
      supportDelaySeconds: 1,
    });
    const second = await build(learningCues, {
      learningDelaySeconds: -1,
      supportCues: [cue(20, 21, 'Different support')],
      supportDelaySeconds: -5,
    });

    expect(second[0].segmentKey).toBe(first[0].segmentKey);
  });
});

describe('listening mission catalog selection', () => {
  it('uses closed intervals, latest start, and smallest source index for overlaps', async () => {
    const overlapping = await build([
      cue(0, 3, 'Long line.'),
      cue(1, 2, 'Later line.'),
      cue(1, 2.5, 'Same-start line.'),
    ]);

    expect(findListeningSegmentContainingTime(overlapping, 1500)?.sourceIndices).toEqual([1]);
    expect(findListeningSegmentContainingTime(overlapping, 2000)?.sourceIndices).toEqual([1]);
  });

  it('chooses the next source-order segment in a gap and returns none after the track', async () => {
    const catalog = await build([
      cue(0, 0.999, 'First.'),
      cue(2, 2.999, 'Second.'),
    ]);

    expect(findNextListeningSegmentInGap(catalog, 1500)?.sourceIndices).toEqual([1]);
    expect(findListeningStartSegment(catalog, 1500)?.sourceIndices).toEqual([1]);
    expect(findListeningStartSegment(catalog, 4000)).toBeUndefined();
  });

  it('selects no more than 10 consecutive source-order segments by index or key', async () => {
    const catalog = await build(separateLines(12));
    const byIndex = selectListeningMissionSegments(catalog, 1);
    const byKey = selectListeningMissionSegments(catalog, catalog[9].segmentKey);

    expect(byIndex).toHaveLength(10);
    expect(byIndex.map(({ sourceIndices }) => sourceIndices)).toEqual(
      Array.from({ length: 10 }, (_, index) => [index + 1])
    );
    expect(byKey).toHaveLength(3);
    expect(selectListeningMissionSegments(catalog, -1)).toEqual([]);
    expect(selectListeningMissionSegments(catalog, 'segment-v1-missing' as never)).toEqual([]);
  });

  it('chooses Continue from unrecorded, then below-cleared, then the first segment', async () => {
    const catalog = await build(separateLines(3));
    const firstAttempted = {
      [catalog[0].segmentKey]: { state: 'attempted' as const },
    };
    const allRecorded = {
      [catalog[0].segmentKey]: { state: 'attempted' as const },
      [catalog[1].segmentKey]: { state: 'cleared' as const },
      [catalog[2].segmentKey]: { state: 'mastered' as const },
    };
    const allCleared = {
      [catalog[0].segmentKey]: { state: 'cleared' as const },
      [catalog[1].segmentKey]: { state: 'mastered' as const },
      [catalog[2].segmentKey]: { state: 'cleared' as const },
    };

    expect(findListeningContinueSegment(catalog, firstAttempted)?.segmentKey).toBe(
      catalog[1].segmentKey
    );
    expect(findListeningContinueSegment(catalog, allRecorded)?.segmentKey).toBe(
      catalog[0].segmentKey
    );
    expect(findListeningContinueSegment(catalog, allCleared)?.segmentKey).toBe(
      catalog[0].segmentKey
    );
    expect(findListeningContinueSegment([], {})).toBeUndefined();
  });
});

const build = (
  learningCues: V2SubtitleCue[],
  options: {
    fenceEndMs?: number | null;
    learningDelaySeconds?: number;
    supportCues?: V2SubtitleCue[];
    supportDelaySeconds?: number;
  } = {}
) => buildListeningSegmentCatalog({ learningCues, sourceKey, ...options });

const cue = (start: number, end: number, text: string): V2SubtitleCue => ({
  start,
  end,
  text,
});

const separateLines = (count: number) => {
  return Array.from({ length: count }, (_, index) =>
    cue(index * 2, index * 2 + 0.999, `Line ${index}.`)
  );
};
