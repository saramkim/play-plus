import { act, createElement } from 'react';

import { LearningCard } from '@storage/v2/type';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import {
  createEditedLearningCard,
  createLearningCardEditorDraft,
  LearningCardEditor,
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

describe('v2 learning card editor presentation', () => {
  it('uses a flat compact hierarchy while preserving field and feedback order', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    document.body.append(container);
    const card = assignedCard('presentation');
    const onSave = async () => {
      throw new Error('Injected update failure');
    };
    const renderEditor = (pending: boolean) =>
      root.render(
        createElement(LearningCardEditor, {
          card,
          disabled: false,
          pending,
          onCancel: () => undefined,
          onSave,
        })
      );

    try {
      act(() => renderEditor(false));

      const form = container.querySelector('form');
      const fieldset = container.querySelector('fieldset');
      const learningText = container.querySelector<HTMLTextAreaElement>(
        `#${card.id}-learning-text`
      );
      const learningLanguage = container.querySelector<HTMLSelectElement>(
        `#${card.id}-learning-language`
      );
      const supportText = container.querySelector<HTMLTextAreaElement>(
        `#${card.id}-support-text`
      );
      const supportGroup = supportText?.parentElement?.parentElement?.parentElement;

      expect(form?.className).toBe('flex min-w-0 flex-col gap-2');
      expect(fieldset?.className).toBe('flex min-w-0 flex-col gap-2');
      expect(supportGroup?.className).toBe('flex min-w-0 flex-col gap-2');
      expect(learningText?.classList.contains('min-h-20')).toBe(true);
      expect(learningLanguage?.classList.contains('h-8')).toBe(true);

      await act(async () => {
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        await Promise.resolve();
      });
      act(() => renderEditor(true));

      const orderedChildren = Array.from(form?.children ?? []);
      expect(orderedChildren[0]?.tagName).toBe('H3');
      expect(orderedChildren[1]?.tagName).toBe('FIELDSET');
      expect(orderedChildren[2]?.getAttribute('role')).toBe('alert');
      expect(orderedChildren[3]?.getAttribute('role')).toBe('status');
      expect(Array.from(orderedChildren[4]?.querySelectorAll('button') ?? []).map((button) =>
        button.textContent
      )).toEqual(['cancel', 'save']);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
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
