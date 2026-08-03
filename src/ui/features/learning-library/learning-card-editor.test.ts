import { LearningCard } from '@storage/v2/type';
import { describe, expect, it } from 'vitest';

import {
  createEditedLearningCard,
  createLearningCardEditorDraft,
  LearningCardEditorDraft,
} from './learning-card-editor';

describe('v2 learning card editor model', () => {
  it('edits assigned lines without changing provenance or study state', () => {
    const card = assignedCard('assigned');
    const edited = createEditedLearningCard(card, {
      learningText: 'Edited learning',
      learningLanguage: 'fr',
      supportEnabled: true,
      supportText: 'Edited support',
      supportLanguage: 'de',
    });

    expect(edited).toEqual({
      ...card,
      content: {
        learning: { text: 'Edited learning', language: 'fr' },
        support: { text: 'Edited support', language: 'de' },
      },
    });
    expect(edited.id).toBe(card.id);
    expect(edited.source).toEqual(card.source);
    expect(edited.createdAt).toBe(card.createdAt);
    expect(edited.studyState).toBe(card.studyState);
  });

  it('adds, removes, and swaps an optional support line through canonical drafts', () => {
    const withoutSupport = assignedCard('learning-only', false);
    expect(createLearningCardEditorDraft(withoutSupport)).toEqual({
      learningText: 'Learning learning-only',
      learningLanguage: 'en',
      supportEnabled: false,
      supportText: '',
      supportLanguage: '',
    });

    const added = createEditedLearningCard(withoutSupport, {
      learningText: 'Learning learning-only',
      learningLanguage: 'en',
      supportEnabled: true,
      supportText: 'Added support',
      supportLanguage: 'ko',
    });
    expect(added.content).toEqual({
      learning: { text: 'Learning learning-only', language: 'en' },
      support: { text: 'Added support', language: 'ko' },
    });

    const removed = createEditedLearningCard(assignedCard('remove'), {
      learningText: 'Learning remove',
      learningLanguage: 'en',
      supportEnabled: false,
      supportText: 'Ignored support draft',
      supportLanguage: 'ko',
    });
    expect(removed.content).toEqual({ learning: { text: 'Learning remove', language: 'en' } });

    const swapped = createEditedLearningCard(assignedCard('swap'), {
      learningText: 'Former support',
      learningLanguage: 'ko',
      supportEnabled: true,
      supportText: 'Former learning',
      supportLanguage: 'en',
    });
    expect(swapped.content).toEqual({
      learning: { text: 'Former support', language: 'ko' },
      support: { text: 'Former learning', language: 'en' },
    });
  });

  it('requires explicit language selection when converting an unassigned card', () => {
    const card = unassignedCard('legacy');
    const draft = createLearningCardEditorDraft(card);

    expect(draft).toEqual({
      learningText: 'Unassigned legacy',
      learningLanguage: '',
      supportEnabled: false,
      supportText: '',
      supportLanguage: '',
    });
    expect(() => createEditedLearningCard(card, draft)).toThrow();

    expect(
      createEditedLearningCard(card, { ...draft, learningLanguage: 'ja' }).content
    ).toEqual({ learning: { text: 'Unassigned legacy', language: 'ja' } });
    expect(
      createEditedLearningCard(card, {
        ...draft,
        learningLanguage: 'ja',
        supportEnabled: true,
        supportText: 'Help',
        supportLanguage: 'en',
      }).content
    ).toEqual({
      learning: { text: 'Unassigned legacy', language: 'ja' },
      support: { text: 'Help', language: 'en' },
    });
  });

  it.each([
    { learningText: '   ' },
    { learningLanguage: '' as const },
    { supportEnabled: true, supportText: '' },
    { supportEnabled: true, supportLanguage: '' as const },
  ])('rejects an invalid retained sentence draft: %o', (override) => {
    const draft: LearningCardEditorDraft = {
      ...createLearningCardEditorDraft(assignedCard('invalid')),
      ...override,
    };

    expect(() => createEditedLearningCard(assignedCard('invalid'), draft)).toThrow();
  });
});

export const assignedCard = (suffix: string, withSupport = true): LearningCard => ({
  id: `card-${suffix}`,
  content: {
    learning: { text: `Learning ${suffix}`, language: 'en' },
    ...(withSupport ? { support: { text: `Support ${suffix}`, language: 'ko' as const } } : {}),
  },
  source: {
    url: `https://www.coupangplay.com/play/${suffix}`,
    startTime: 10,
    endTime: 12,
    title: `Title ${suffix}`,
  },
  studyState: 'active',
  createdAt: '2026-08-02T00:00:00.000Z',
});

export const unassignedCard = (suffix: string): LearningCard => ({
  id: `card-${suffix}`,
  content: { unassigned: { text: `Unassigned ${suffix}`, language: 'und' } },
  source: { url: `https://www.coupangplay.com/play/${suffix}`, startTime: 20 },
  studyState: 'completed',
  createdAt: '2026-08-03T00:00:00.000Z',
});
