import { SubtitleId } from '@storage/subtitle';
import { describe, expect, it } from 'vitest';

import { buildAnalysisSavedSubtitleDraft, SubtitleTrackSnapshot } from './saved-subtitle-card';

const URL = 'https://www.coupangplay.com/play/example';
const CUSTOM_ID = 'subtitle-11111111-1111-4111-8111-111111111111' as SubtitleId;
const primaryTrack: SubtitleTrackSnapshot = {
  id: 'en',
  language: 'en',
  subtitles: [{ text: 'Hello', start: 1, end: 3 }],
};
const secondaryTrack: SubtitleTrackSnapshot = {
  id: CUSTOM_ID,
  language: 'ko',
  subtitles: [{ text: '안녕하세요', start: 1, end: 2.5 }],
};

describe('analysis saved subtitle card', () => {
  it('pairs configured primary and secondary cues at the selected time', () => {
    const draft = buildAnalysisSavedSubtitleDraft({
      selectedSubtitle: primaryTrack.subtitles[0],
      selectedTrack: primaryTrack,
      primaryTrack,
      secondaryTrack,
      url: URL,
    });

    expect(draft).toEqual({
      primary: { text: 'Hello', language: 'en' },
      secondary: { text: '안녕하세요', language: 'ko' },
      url: URL,
      startTime: 1,
    });
  });

  it('keeps configured roles when saving from the secondary track', () => {
    const draft = buildAnalysisSavedSubtitleDraft({
      selectedSubtitle: secondaryTrack.subtitles[0],
      selectedTrack: secondaryTrack,
      primaryTrack,
      secondaryTrack,
      url: URL,
    });

    expect(draft.primary).toEqual({ text: 'Hello', language: 'en' });
    expect(draft.secondary).toEqual({ text: '안녕하세요', language: 'ko' });
    expect(draft.startTime).toBe(1);
  });

  it('promotes a secondary-only cue when no primary counterpart is active', () => {
    const draft = buildAnalysisSavedSubtitleDraft({
      selectedSubtitle: secondaryTrack.subtitles[0],
      selectedTrack: secondaryTrack,
      primaryTrack: { ...primaryTrack, subtitles: [] },
      secondaryTrack,
      url: URL,
    });

    expect(draft.primary).toEqual({ text: '안녕하세요', language: 'ko' });
    expect(draft.secondary).toBeUndefined();
    expect(draft.startTime).toBe(1);
  });

  it('saves an unconfigured selected track as a single primary line', () => {
    const selectedTrack: SubtitleTrackSnapshot = {
      id: 'ko',
      language: 'ko',
      subtitles: [{ text: '<i>독립 트랙</i>', start: 4, end: 5 }],
    };
    const draft = buildAnalysisSavedSubtitleDraft({
      selectedSubtitle: selectedTrack.subtitles[0],
      selectedTrack,
      primaryTrack,
      secondaryTrack,
      url: URL,
    });

    expect(draft.primary).toEqual({ text: '독립 트랙', language: 'ko' });
    expect(draft.secondary).toBeUndefined();
  });

  it('omits language when uploaded metadata is unavailable', () => {
    const selectedTrack: SubtitleTrackSnapshot = {
      id: CUSTOM_ID,
      subtitles: [{ text: 'Unknown language', start: 6, end: 7 }],
    };
    const draft = buildAnalysisSavedSubtitleDraft({
      selectedSubtitle: selectedTrack.subtitles[0],
      selectedTrack,
      url: URL,
    });

    expect(draft.primary).toEqual({ text: 'Unknown language' });
  });
});
