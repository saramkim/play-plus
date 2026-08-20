import { V2SubtitleCue } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';

import { resolveLearningCueCommand } from '@/content/features/learning-playback/learning-playback';

describe('learning playback resolver', () => {
  it('normalizes cue boundaries to milliseconds and treats them as closed', () => {
    const cues = [cue(0.0005, 1, 'Rounded')];

    expect(resolve('save', cues, 0.00049)).toEqual({ status: 'no-current-cue' });
    expect(resolvedText(resolve('save', cues, 0.00051))).toBe('Rounded');
    expect(resolvedText(resolve('save', cues, 1))).toBe('Rounded');
  });

  it('selects the later-starting cue at a shared boundary', () => {
    const cues = [cue(0, 1, 'Earlier'), cue(1, 2, 'Later')];

    expect(resolvedText(resolve('save', cues, 1))).toBe('Later');
  });

  it('uses source index after the start-time tie-break for overlapping anchors', () => {
    const cues = [cue(0, 3, 'First'), cue(1, 3, 'Later start'), cue(1, 2, 'Same start later index')];

    expect(resolvedText(resolve('repeat-current', cues, 1.5))).toBe('Later start');
  });

  it('uses adjacent valid source-order cues around an anchor', () => {
    const cues = [cue(0, 1, 'Previous'), cue(1, 2, '  '), cue(2, 3, 'Current'), cue(4, 5, 'Next')];

    expect(resolvedText(resolve('previous', cues, 2.5))).toBe('Previous');
    expect(resolvedText(resolve('next', cues, 2.5))).toBe('Next');
  });

  it('resolves nearest previous and next cues in a gap', () => {
    const cues = [cue(0, 1, 'First'), cue(2, 3, 'Second'), cue(5, 6, 'Third')];

    expect(resolvedText(resolve('previous', cues, 4))).toBe('Second');
    expect(resolvedText(resolve('next', cues, 4))).toBe('Third');
    expect(resolve('repeat-current', cues, 4)).toEqual({ status: 'no-current-cue' });
    expect(resolve('save', cues, 4)).toEqual({ status: 'no-current-cue' });
  });

  it('skips fence-outside targets and permits an explicit move back from post-fence time', () => {
    const cues = [
      { start: 1, end: 2, text: 'Before fence' },
      { start: 4.5, end: 5.5, text: 'Crossing fence' },
      { start: 6, end: 7, text: 'Beyond fence' },
    ];

    expect(
      resolvedText(
        resolveLearningCueCommand({
          command: 'previous',
          cues,
          currentTime: 8,
          fenceEndMs: 5000,
        })
      )
    ).toBe('Before fence');
    expect(
      resolveLearningCueCommand({
        command: 'next',
        cues,
        currentTime: 2.5,
        fenceEndMs: 5000,
      })
    ).toEqual({ status: 'no-target-cue' });
  });

  it('handles positions before the first and after the last valid cue', () => {
    const cues = [cue(1, 2, 'First'), cue(3, 4, 'Last')];

    expect(resolve('previous', cues, 0)).toEqual({ status: 'no-target-cue' });
    expect(resolvedText(resolve('next', cues, 0))).toBe('First');
    expect(resolvedText(resolve('previous', cues, 5))).toBe('Last');
    expect(resolve('next', cues, 5)).toEqual({ status: 'no-target-cue' });
  });

  it('applies positive and negative learning delays exactly once', () => {
    const cues = [cue(1, 2, 'Delayed')];

    expect(resolvedText(resolve('save', cues, 2.5, 1))).toBe('Delayed');
    expect(resolve('save', cues, 3.5, 1)).toEqual({ status: 'no-current-cue' });
    expect(resolvedText(resolve('save', cues, 0.5, -1))).toBe('Delayed');
  });

  it('returns explicit empty results when there are no valid cues', () => {
    const cues = [cue(0, 1, ''), cue(1, 2, '   '), cue(2, 3, '<i></i>')];

    expect(resolve('previous', cues, 1)).toEqual({ status: 'no-target-cue' });
    expect(resolve('next', cues, 1)).toEqual({ status: 'no-target-cue' });
    expect(resolve('save', cues, 1)).toEqual({ status: 'no-current-cue' });
    expect(resolve('save', cues, 2.5)).toEqual({ status: 'no-current-cue' });
  });
});

const cue = (start: number, end: number, text: string): V2SubtitleCue => ({ start, end, text });

const resolve = (
  command: Parameters<typeof resolveLearningCueCommand>[0]['command'],
  cues: V2SubtitleCue[],
  currentTime: number,
  delaySeconds = 0
) => resolveLearningCueCommand({ command, cues, currentTime, delaySeconds });

const resolvedText = (result: ReturnType<typeof resolveLearningCueCommand>) => {
  if (result.status !== 'resolved') throw new Error(`Expected a resolved cue, received ${result.status}`);
  return result.cue.cue.text;
};
