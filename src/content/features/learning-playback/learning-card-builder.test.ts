import { describe, expect, it, vi } from 'vitest';

import { buildLearningCard } from '@/content/features/learning-playback/learning-card-builder';

describe('learning card builder', () => {
  it('creates a strict learning-only active card without a title', () => {
    const result = build({ supportLanguage: null });

    expect(result).toEqual({
      status: 'created',
      card: {
        id: 'card-test-id',
        content: { learning: { text: 'Learning', language: 'en' } },
        source: { url: URL, startTime: 1, endTime: 2 },
        studyState: 'active',
        createdAt: CREATED_AT,
      },
    });
  });

  it('creates a learning and multi-cue support card', () => {
    const result = build({
      supportCues: [
        { start: 1, end: 1.5, text: '도움' },
        { start: 1.5, end: 2, text: '문장' },
      ],
    });

    expect(result).toMatchObject({
      status: 'created',
      card: {
        content: {
          learning: { text: 'Learning', language: 'en' },
          support: { text: '도움\n문장', language: 'ko' },
        },
      },
    });
  });

  it('stores source times after applying the learning delay once', () => {
    const result = build({ currentTime: 0.5, learningDelaySeconds: -1 });

    expect(result).toMatchObject({
      status: 'created',
      card: { source: { startTime: 0, endTime: 1 } },
    });
  });

  it('omits support when timing confidence is low without failing creation', () => {
    const result = build({ supportCues: [{ start: 5, end: 6, text: 'Far away' }] });

    expect(result).toMatchObject({ status: 'created', card: { content: { learning: { text: 'Learning' } } } });
    if (result.status === 'created') expect(result.card.content).not.toHaveProperty('support');
  });

  it('does not call factories when there is no current learning cue', () => {
    const idFactory = vi.fn(() => 'card-unused');
    const createdAtFactory = vi.fn(() => CREATED_AT);
    const result = buildLearningCard({
      learningCues: [{ start: 1, end: 2, text: 'Learning' }],
      currentTime: 3,
      learningLanguage: 'en',
      supportLanguage: null,
      url: URL,
      idFactory,
      createdAtFactory,
    });

    expect(result).toEqual({ status: 'no-current-cue' });
    expect(idFactory).not.toHaveBeenCalled();
    expect(createdAtFactory).not.toHaveBeenCalled();
  });

  it('validates injected IDs and times with the canonical schema', () => {
    expect(() => build({ idFactory: () => crypto.randomUUID() })).toThrow();
    expect(() => build({ createdAtFactory: () => 'not-a-date' })).toThrow();
  });

  it('uses a canonical card-prefixed production ID', () => {
    const result = buildLearningCard({
      learningCues: [{ start: 1, end: 2, text: 'Learning' }],
      currentTime: 1.5,
      learningLanguage: 'en',
      supportLanguage: null,
      url: URL,
      createdAtFactory: () => CREATED_AT,
    });

    expect(result).toMatchObject({ status: 'created', card: { id: expect.stringMatching(/^card-/) } });
  });

  it('creates distinct cards for repeated save requests', () => {
    let nextId = 0;
    const idFactory = () => `card-repeat-${nextId++}`;

    const first = build({ idFactory });
    const second = build({ idFactory });

    expect(first).toMatchObject({ status: 'created', card: { id: 'card-repeat-0' } });
    expect(second).toMatchObject({ status: 'created', card: { id: 'card-repeat-1' } });
  });
});

const URL = 'https://www.coupangplay.com/play/example';
const CREATED_AT = '2026-08-02T00:00:00.000Z';

const build = (overrides: Partial<Parameters<typeof buildLearningCard>[0]> = {}) => {
  return buildLearningCard({
    learningCues: [{ start: 1, end: 2, text: 'Learning' }],
    currentTime: 1.5,
    learningLanguage: 'en',
    supportLanguage: 'ko',
    url: URL,
    idFactory: () => 'card-test-id',
    createdAtFactory: () => CREATED_AT,
    ...overrides,
  });
};
