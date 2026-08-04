import { describe, expect, it } from 'vitest';

import { learningCardSchema, v2LocalDataSchema, v2SyncStorageSchema } from './schema';

const assignedCard = {
  id: 'card-00000000-0000-4000-8000-000000000001',
  content: {
    learning: { text: 'Hello', language: 'en' },
    support: { text: '안녕하세요', language: 'ko' },
  },
  source: { url: 'https://www.coupangplay.com/play/example', startTime: 1, endTime: 2 },
  studyState: 'active',
  createdAt: '2026-08-02T00:00:00.000Z',
};

describe('v2 learning card schema', () => {
  it('accepts assigned and unassigned canonical cards', () => {
    expect(learningCardSchema.parse(assignedCard)).toEqual(assignedCard);
    expect(
      learningCardSchema.safeParse({
        ...assignedCard,
        content: { unassigned: { text: 'Unknown role', language: 'und' } },
      }).success
    ).toBe(true);
  });

  it('rejects mixed roles, empty text, extra fields, and reversed source ranges', () => {
    const invalidCards = [
      {
        ...assignedCard,
        content: {
          learning: { text: 'Hello', language: 'en' },
          unassigned: { text: 'Unknown', language: 'und' },
        },
      },
      { ...assignedCard, content: { learning: { text: '', language: 'en' } } },
      { ...assignedCard, unexpected: true },
      (({ createdAt: _createdAt, ...card }) => card)(assignedCard),
      { ...assignedCard, source: { ...assignedCard.source, startTime: 3, endTime: 2 } },
    ];

    for (const card of invalidCards) expect(learningCardSchema.safeParse(card).success).toBe(false);
  });
});

describe('v2 storage schemas', () => {
  it('rejects noncanonical local and sync fields', () => {
    expect(
      v2SyncStorageSchema.safeParse({
        learningProfile: { learningLanguage: 'en', supportLanguage: 'ko' },
        subtitleDisplay: {
          learning: {
            visibility: 'visible',
            appearance: {
              positionReference: 'bottom',
              positionOffset: 0,
              color: '#ffffff',
              fontSize: 6,
              fontWeight: 4,
              backgroundOpacity: 0,
              lineBreak: true,
            },
          },
          support: {
            visibility: 'hidden',
            appearance: {
              positionReference: 'bottom',
              positionOffset: 0,
              color: '#ffffff',
              fontSize: 4,
              fontWeight: 2,
              backgroundOpacity: 0,
              lineBreak: false,
            },
          },
        },
        learningControls: {
          previousCue: { enabled: true },
          nextCue: { enabled: true },
          repeatCurrentCue: { enabled: false },
        },
        shortcuts: {
          enabled: true,
          saveCard: 'KeyS',
          previousCue: 'KeyA',
          nextCue: 'KeyD',
          repeatCurrentCue: 'KeyR',
          copyPrimary: 'KeyC',
        },
        playbackSpeed: { enabled: false, increase: '', decrease: '', reset: '' },
      }).success
    ).toBe(false);

    expect(
      v2LocalDataSchema.safeParse({
        learningCards: [assignedCard],
        registeredSubtitles: [],
        subtitleBodies: { invalid: [] },
        migrationState: {
          status: 'complete',
          sourceVersion: null,
          shortcutConfirmations: [],
          unavailableRegisteredSubtitles: [],
        },
      }).success
    ).toBe(false);
  });

  it('rejects reserved and duplicate canonical shortcuts', () => {
    const valid = {
      learningProfile: { learningLanguage: 'en', supportLanguage: 'ko' },
      subtitleDisplay: {
        learning: {
          visibility: 'visible',
          appearance: {
            positionReference: 'bottom',
            positionOffset: 0,
            color: '#ffffff',
            fontSize: 6,
            fontWeight: 4,
            backgroundOpacity: 0,
            lineBreak: true,
          },
        },
        support: {
          visibility: 'hidden',
          appearance: {
            positionReference: 'bottom',
            positionOffset: 0,
            color: '#ffffff',
            fontSize: 4,
            fontWeight: 2,
            backgroundOpacity: 0,
            lineBreak: false,
          },
        },
      },
      learningControls: {
        previousCue: { enabled: true },
        nextCue: { enabled: true },
        repeatCurrentCue: { enabled: false },
      },
      shortcuts: {
        enabled: true,
        saveCard: 'KeyS',
        previousCue: 'ArrowLeft',
        nextCue: 'ArrowRight',
        repeatCurrentCue: 'KeyR',
      },
      playbackSpeed: { enabled: true, increase: 'BracketRight', decrease: 'BracketLeft', reset: 'KeyP' },
    } as const;

    expect(
      v2SyncStorageSchema.safeParse({
        ...valid,
        shortcuts: { ...valid.shortcuts, saveCard: 'Space' },
      }).success
    ).toBe(false);
    expect(
      v2SyncStorageSchema.safeParse({
        ...valid,
        playbackSpeed: { ...valid.playbackSpeed, increase: valid.shortcuts.previousCue },
      }).success
    ).toBe(false);
  });
});
