import { describe, expect, it } from 'vitest';

import { buildRoleLearningCard } from '@/content/features/learning-playback/learning-card-builder';
import { resolveCue } from '@/content/features/learning-playback/learning-playback';
import { learningCardSchema } from '@/storage/v2/schema';
import { getFocusedReviewQueue } from '@/ui/features/focused-review/focused-review';

import { createEditedLearningCard, createLearningCardEditorDraft } from './learning-card-editor';
import { getLearningCardSearchText, getVisibleLearningCards } from './learning-card-library';

describe('support-only card lifecycle', () => {
  it('preserves own role, language and delayed interval through search, edit and review exclusion', () => {
    const result = buildRoleLearningCard({ role: 'support', language: 'ko',
      cue: resolveCue({ start: 10, end: 12, text: '<b>보조 문장</b>' }, 3, 1.5),
      url: 'https://www.coupangplay.com/play/123e4567-e89b-12d3-a456-426614174000',
    });
    if (result.status !== 'created') throw new Error('Expected a support card');
    const card = result.card;
    expect(card.content).toEqual({ support: { text: '보조 문장', language: 'ko' } });
    expect(card.source).toMatchObject({ startTime: 11.5, endTime: 13.5 });
    expect(getLearningCardSearchText(card)).toBe('보조 문장');
    expect(getVisibleLearningCards([card], { searchText: '보조', role: 'support', sort: 'latest', studyState: 'all' })).toEqual([card]);
    expect(getVisibleLearningCards([card], { searchText: '', role: 'learning', sort: 'latest', studyState: 'all' })).toEqual([]);
    expect(getFocusedReviewQueue([card], 'active')).toEqual([]);
    const draft = createLearningCardEditorDraft(card);
    expect(createEditedLearningCard(card, draft)).toEqual(card);
    expect(() => createEditedLearningCard(card, { ...draft, supportEnabled: false })).toThrow();
    const assigned = createEditedLearningCard(card, { ...draft, learningEnabled: true, learningText: 'Learning', learningLanguage: 'en' });
    expect(assigned.source).toEqual(card.source);
    expect(getFocusedReviewQueue([assigned], 'active')).toEqual([assigned]);
    expect(learningCardSchema.safeParse({ ...card, content: { ...card.content, unassigned: { text: 'x', language: 'und' } } }).success).toBe(false);
  });
});
