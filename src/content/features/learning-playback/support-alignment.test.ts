import { V2SubtitleCue } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';

import { resolveCue } from '@/content/features/learning-playback/learning-playback';
import {
  alignSupportCues,
  compareSupportAlignments,
  isWithinSupportWindow,
  SupportAlignment,
} from '@/content/features/learning-playback/support-alignment';

describe('support alignment', () => {
  it('selects an exact one-to-one pair', () => {
    const result = align([cue(0, 1, 'Support')]);

    expect(result).toMatchObject({ text: 'Support', score: 1, overlapDurationMs: 1001, centerDistanceMs: 0 });
  });

  it('joins the strongest two- and three-cue groups in source order', () => {
    expect(
      align([cue(0, 0.4, 'One'), cue(0.4, 1, 'Two')])
    ).toMatchObject({ text: 'One\nTwo' });
    expect(
      align([cue(0, 0.3, 'One'), cue(0.3, 0.6, 'Two'), cue(0.6, 1, 'Three')])
    ).toMatchObject({ text: 'One\nTwo\nThree' });
  });

  it('selects one support cue that contains the learning interval', () => {
    const result = align([cue(-0.1, 1.1, 'Containing')]);

    expect(result?.text).toBe('Containing');
  });

  it('applies positive and negative support delays before matching', () => {
    expect(align([cue(2, 3, 'Late')])).toBeUndefined();
    expect(align([cue(2, 3, 'Late')], -2)?.text).toBe('Late');
    expect(align([cue(-2, -1, 'Early')], 2)?.text).toBe('Early');
  });

  it('allows a 750ms internal gap and rejects a 751ms group', () => {
    const learningCue = resolveCue(cue(0, 2, 'Learning'), 0);
    const allowed = alignSupportCues({
      learningCue,
      supportCues: [cue(0, 0.5, 'One'), cue(1.251, 2, 'Two')],
    });
    const rejected = alignSupportCues({
      learningCue,
      supportCues: [cue(0, 0.5, 'One'), cue(1.252, 2, 'Two')],
    });

    expect(allowed?.text).toBe('One\nTwo');
    expect(rejected?.text).not.toBe('One\nTwo');
  });

  it('limits a candidate group to three cues', () => {
    const learningCue = resolveCue(cue(0, 4, 'Learning'), 0);
    const result = alignSupportCues({
      learningCue,
      supportCues: [
        cue(0, 1, 'One'),
        cue(1, 2, 'Two'),
        cue(2, 3, 'Three'),
        cue(3, 4, 'Four'),
      ],
    });

    expect(result?.cues).toHaveLength(3);
    expect(result?.text).not.toContain('One\nTwo\nThree\nFour');
  });

  it('includes the closed 3000ms window boundary', () => {
    const pointLearningCue = resolveCue(cue(0, 0, 'Learning'), 0);
    const boundaryCue = resolveCue(cue(3, 3, 'Boundary'), 0);
    const outsideCue = resolveCue(cue(3.001, 3.001, 'Outside'), 0);

    expect(isWithinSupportWindow(pointLearningCue, [boundaryCue])).toBe(true);
    expect(isWithinSupportWindow(pointLearningCue, [outsideCue])).toBe(false);
  });

  it('accepts a rounded score of exactly 0.55 and rejects the next lower fixture', () => {
    const accepted = align([cue(-1.267, 1.18, 'Accepted')]);
    const rejected = align([cue(-1.268, 1.18, 'Rejected')]);

    expect(accepted?.score).toBe(0.55);
    expect(rejected).toBeUndefined();
  });

  it('treats empty support cues as group boundaries', () => {
    const result = align([cue(0, 0.5, 'One'), cue(0.5, 0.5, '  '), cue(0.5, 1, 'Two')]);

    expect(result?.text).toBe('One');
  });

  it('omits low-confidence support regardless of text equality', () => {
    expect(align([cue(3, 4, 'Learning')])).toBeUndefined();
    expect(align([cue(0, 1, 'Different text')])?.text).toBe('Different text');
  });

  it('orders fully tied candidates by cue count and source index', () => {
    const single = alignment({ cueCount: 1, firstSourceIndex: 5 });
    const multiple = alignment({ cueCount: 2, firstSourceIndex: 0 });
    const earlier = alignment({ cueCount: 1, firstSourceIndex: 1 });

    expect(compareSupportAlignments(single, multiple)).toBeLessThan(0);
    expect(compareSupportAlignments(earlier, single)).toBeLessThan(0);
  });

  it('applies score, overlap, and center-distance tie-breaks in order', () => {
    expect(compareSupportAlignments(alignment({ score: 0.8 }), alignment({ score: 0.7 }))).toBeLessThan(0);
    expect(
      compareSupportAlignments(alignment({ overlapDurationMs: 900 }), alignment({ overlapDurationMs: 800 }))
    ).toBeLessThan(0);
    expect(
      compareSupportAlignments(alignment({ centerDistanceMs: 10 }), alignment({ centerDistanceMs: 20 }))
    ).toBeLessThan(0);
  });
});

const learningCue = resolveCue({ start: 0, end: 1, text: 'Learning' }, 0);

const align = (supportCues: V2SubtitleCue[], supportDelaySeconds = 0) => {
  return alignSupportCues({ learningCue, supportCues, supportDelaySeconds });
};

const cue = (start: number, end: number, text: string): V2SubtitleCue => ({ start, end, text });

const alignment = ({
  score = 0.7,
  overlapDurationMs = 500,
  centerDistanceMs = 100,
  cueCount = 1,
  firstSourceIndex = 0,
}: Partial<SupportAlignment> & { cueCount?: number; firstSourceIndex?: number } = {}): SupportAlignment => ({
  score,
  overlapDurationMs,
  centerDistanceMs,
  text: 'Support',
  cues: Array.from({ length: cueCount }, (_, index) =>
    resolveCue(cue(0, 1, `Support ${index}`), firstSourceIndex + index)
  ),
});
