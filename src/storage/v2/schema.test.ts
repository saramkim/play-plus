import { describe, expect, it } from 'vitest';

import {
  createDefaultListeningProgress,
  createDefaultV2LocalData,
  DEFAULT_V2_SYNC_STORAGE,
} from './default';
import {
  isReservedV2Shortcut,
  learningCardSchema,
  listeningProgressSchema,
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
  V2_RESERVED_SHORTCUTS,
  v2LocalDataSchema,
  v2SyncStorageSchema,
} from './schema';

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

const listeningSource = 'native:en';
const listeningSegment = `segment-v1-${'a'.repeat(64)}`;
const practicedAt = '2026-08-09T02:00:00.000+12:00';

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
        ...DEFAULT_V2_SYNC_STORAGE,
        learningControls: {
          previousCue: { enabled: true },
          nextCue: { enabled: true },
          repeatCurrentCue: { enabled: false },
        },
      }).success
    ).toBe(false);

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
        listeningProgress: createDefaultListeningProgress(),
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

  it('uses the exported reserved-shortcut contract for canonical validation', () => {
    expect(V2_RESERVED_SHORTCUTS).toContain('Space');
    expect(isReservedV2Shortcut('Space')).toBe(true);
    expect(isReservedV2Shortcut('KeyS')).toBe(false);
  });
});

describe('v2 listening progress schema', () => {
  const validProgress = () => ({
    version: 1 as const,
    videos: {
      'video-one': {
        sources: {
          [listeningSource]: {
            segmenterVersion: 1 as const,
            bestCombo: 3,
            lastPracticedAt: practicedAt,
            items: {
              [listeningSegment]: {
                state: 'mastered' as const,
                totalAttempts: 1,
                lastPracticedAt: practicedAt,
              },
            },
          },
        },
      },
    },
  });

  it('accepts strict empty progress and both approved source-key formats', () => {
    expect(listeningProgressSchema.parse(createDefaultListeningProgress())).toEqual({
      version: 1,
      videos: {},
    });
    expect(listeningSourceKeySchema.safeParse('native:en').success).toBe(true);
    expect(
      listeningSourceKeySchema.safeParse(
        'registered:subtitle-11111111-1111-4111-8111-111111111111'
      ).success
    ).toBe(true);
    expect(listeningSegmentKeySchema.safeParse(listeningSegment).success).toBe(true);
    expect(listeningProgressSchema.safeParse(validProgress()).success).toBe(true);
  });

  it('accepts only valid progress-state and attempt-count combinations', () => {
    const cases = [
      ['attempted', 0, true],
      ['attempted', 1, true],
      ['cleared', 0, false],
      ['cleared', 1, true],
      ['mastered', 0, false],
      ['mastered', 1, true],
    ] as const;

    for (const [state, totalAttempts, accepted] of cases) {
      expect(
        listeningProgressSchema.safeParse(progressWithItemField({ state, totalAttempts })).success
      ).toBe(accepted);
    }
  });

  it('requires the progress key in canonical local data', () => {
    const local = createDefaultV2LocalData();
    expect(v2LocalDataSchema.safeParse(local).success).toBe(true);
    const { listeningProgress: _progress, ...missingProgress } = local;
    expect(v2LocalDataSchema.safeParse(missingProgress).success).toBe(false);
  });

  it('rejects invalid identities, counters, timestamps, versions, and states', () => {
    const invalidValues = [
      { ...validProgress(), version: 2 },
      { ...validProgress(), videos: { '': validProgress().videos['video-one'] } },
      progressWithSource('native:invalid'),
      progressWithSource('registered:invalid'),
      progressWithSegment('segment-v1-A'.padEnd('segment-v1-'.length + 64, 'A')),
      progressWithSourceField({ segmenterVersion: 2 }),
      progressWithSourceField({ bestCombo: -1 }),
      progressWithSourceField({ bestCombo: 1.5 }),
      progressWithSourceField({ bestCombo: Number.MAX_SAFE_INTEGER + 1 }),
      progressWithSourceField({ lastPracticedAt: '2026-08-09T02:00:00' }),
      progressWithItemField({ state: 'learning' }),
      progressWithItemField({ totalAttempts: -1 }),
      progressWithItemField({ totalAttempts: 1.5 }),
      progressWithItemField({ totalAttempts: Number.MAX_SAFE_INTEGER + 1 }),
      progressWithItemField({ lastPracticedAt: 'not-a-date' }),
    ];

    for (const value of invalidValues) {
      expect(listeningProgressSchema.safeParse(value).success).toBe(false);
    }
  });

  it('rejects forbidden answer, history, URL, body, support, mission, star, and accuracy fields', () => {
    const forbiddenFields = [
      'answer',
      'answerDraft',
      'sourceUrl',
      'subtitleBody',
      'supportText',
      'mission',
      'history',
      'stars',
      'streak',
      'accuracy',
    ];

    for (const field of forbiddenFields) {
      expect(listeningProgressSchema.safeParse({ ...validProgress(), [field]: 'forbidden' }).success).toBe(
        false
      );
      expect(listeningProgressSchema.safeParse(progressWithItemField({ [field]: 'forbidden' })).success).toBe(
        false
      );
    }
  });

  const progressWithSource = (sourceKey: string) => ({
    ...validProgress(),
    videos: {
      'video-one': {
        sources: { [sourceKey]: validProgress().videos['video-one'].sources[listeningSource] },
      },
    },
  });

  const progressWithSegment = (segmentKey: string) => ({
    ...validProgress(),
    videos: {
      'video-one': {
        sources: {
          [listeningSource]: {
            ...validProgress().videos['video-one'].sources[listeningSource],
            items: {
              [segmentKey]:
                validProgress().videos['video-one'].sources[listeningSource].items[listeningSegment],
            },
          },
        },
      },
    },
  });

  const progressWithSourceField = (field: Record<string, unknown>) => ({
    ...validProgress(),
    videos: {
      'video-one': {
        sources: {
          [listeningSource]: {
            ...validProgress().videos['video-one'].sources[listeningSource],
            ...field,
          },
        },
      },
    },
  });

  const progressWithItemField = (field: Record<string, unknown>) => ({
    ...validProgress(),
    videos: {
      'video-one': {
        sources: {
          [listeningSource]: {
            ...validProgress().videos['video-one'].sources[listeningSource],
            items: {
              [listeningSegment]: {
                ...validProgress().videos['video-one'].sources[listeningSource].items[
                  listeningSegment
                ],
                ...field,
              },
            },
          },
        },
      },
    },
  });
});
