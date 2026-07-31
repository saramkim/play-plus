import { describe, expect, it } from 'vitest';

import { buildPlayerSavedSubtitleDraft } from './saved-subtitle-card';

const URL = 'https://www.coupangplay.com/play/example';

describe('player saved subtitle card', () => {
  it('captures both active roles with the primary cue as the canonical source time', () => {
    expect(
      buildPlayerSavedSubtitleDraft({
        primary: { text: 'Hello', language: 'en', startTime: 1 },
        secondary: { text: '안녕하세요', language: 'ko', startTime: 0.5 },
        url: URL,
      })
    ).toEqual({
      primary: { text: 'Hello', language: 'en' },
      secondary: { text: '안녕하세요', language: 'ko' },
      url: URL,
      startTime: 1,
    });
  });

  it('promotes a secondary-only player snapshot', () => {
    expect(
      buildPlayerSavedSubtitleDraft({
        secondary: { text: '안녕하세요', language: 'ko', startTime: 2 },
        url: URL,
      })
    ).toEqual({
      primary: { text: '안녕하세요', language: 'ko' },
      secondary: undefined,
      url: URL,
      startTime: 2,
    });
  });
});
