import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { learningCardSchema } from '@storage/v2/schema';
import { LearningCard } from '@storage/v2/type';
import { LANGUAGES, Language } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';

export interface LearningCardEditorDraft {
  learningText: string;
  learningLanguage: Language | '';
  supportEnabled: boolean;
  supportText: string;
  supportLanguage: Language | '';
}

interface LearningCardEditorProps {
  card: LearningCard;
  disabled: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: (card: LearningCard) => Promise<void>;
}

const LANGUAGE_OPTIONS = Object.entries(LANGUAGES) as [Language, (typeof LANGUAGES)[Language]][];

export function LearningCardEditor({
  card,
  disabled,
  pending,
  onCancel,
  onSave,
}: LearningCardEditorProps) {
  const [draft, setDraft] = useState(() => createLearningCardEditorDraft(card));
  const [error, setError] = useState<string>();
  const errorId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const initializedCardIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (initializedCardIdRef.current === card.id) return;
    initializedCardIdRef.current = card.id;
    setDraft(createLearningCardEditorDraft(card));
    setError(undefined);
    headingRef.current?.focus();
  }, [card]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    try {
      await onSave(createEditedLearningCard(card, draft));
    } catch (caught) {
      setError(
        caught instanceof LearningCardEditorValidationError
          ? caught.message
          : t('v2_library_update_error')
      );
    }
  };

  const swapRoles = () => {
    if (!draft.supportEnabled) return;
    setDraft((current) => ({
      ...current,
      learningText: current.supportText,
      learningLanguage: current.supportLanguage,
      supportText: current.learningText,
      supportLanguage: current.learningLanguage,
    }));
  };

  return (
    <form
      className='flex min-w-0 flex-col gap-3 rounded-lg border bg-muted/20 p-3'
      aria-busy={pending}
      aria-describedby={error ? errorId : undefined}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <h3 ref={headingRef} tabIndex={-1} className='text-sm font-semibold outline-none'>
        {t('unassigned' in card.content ? 'v2_library_editor_assign_title' : 'v2_library_editor_title')}
      </h3>

      <fieldset className='flex min-w-0 flex-col gap-3' disabled={disabled}>
        <EditorLine
          idPrefix={`${card.id}-learning`}
          textLabel={t('v2_library_learning_text')}
          languageLabel={t('v2_library_learning_language')}
          text={draft.learningText}
          language={draft.learningLanguage}
          onTextChange={(learningText) => setDraft((current) => ({ ...current, learningText }))}
          onLanguageChange={(learningLanguage) =>
            setDraft((current) => ({ ...current, learningLanguage }))
          }
        />

        {draft.supportEnabled ? (
          <div className='flex min-w-0 flex-col gap-2 rounded-md border bg-background p-2'>
            <EditorLine
              idPrefix={`${card.id}-support`}
              textLabel={t('v2_library_support_text')}
              languageLabel={t('v2_library_support_language')}
              text={draft.supportText}
              language={draft.supportLanguage}
              onTextChange={(supportText) => setDraft((current) => ({ ...current, supportText }))}
              onLanguageChange={(supportLanguage) =>
                setDraft((current) => ({ ...current, supportLanguage }))
              }
            />
            <div className='flex flex-wrap gap-2'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-auto min-h-8 whitespace-normal text-wrap'
                onClick={swapRoles}
              >
                {t('v2_library_swap_roles')}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-auto min-h-8 whitespace-normal text-wrap'
                onClick={() => setDraft((current) => ({ ...current, supportEnabled: false }))}
              >
                {t('v2_library_remove_support')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-auto min-h-8 whitespace-normal text-wrap'
            onClick={() => setDraft((current) => ({ ...current, supportEnabled: true }))}
          >
            {t('v2_library_add_support')}
          </Button>
        )}
      </fieldset>

      {error && (
        <p id={errorId} role='alert' className='text-wrap text-sm text-destructive'>
          {error}
        </p>
      )}
      {pending && (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('v2_library_save_pending')}
        </p>
      )}

      <div className='grid grid-cols-2 gap-2'>
        <Button type='button' variant='outline' disabled={disabled} onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={disabled}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}

interface EditorLineProps {
  idPrefix: string;
  textLabel: string;
  languageLabel: string;
  text: string;
  language: Language | '';
  onTextChange: (value: string) => void;
  onLanguageChange: (value: Language | '') => void;
}

function EditorLine({
  idPrefix,
  textLabel,
  languageLabel,
  text,
  language,
  onTextChange,
  onLanguageChange,
}: EditorLineProps) {
  const textId = `${idPrefix}-text`;
  const languageId = `${idPrefix}-language`;

  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <label className='flex min-w-0 flex-col gap-1 text-sm font-medium' htmlFor={textId}>
        {textLabel}
        <textarea
          id={textId}
          className='min-h-20 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50'
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </label>
      <label className='flex min-w-0 flex-col gap-1 text-sm font-medium' htmlFor={languageId}>
        {languageLabel}
        <select
          id={languageId}
          className='h-8 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50'
          value={language}
          onChange={(event) => onLanguageChange(asLanguage(event.target.value))}
        >
          <option value=''>{t('v2_library_choose_language')}</option>
          {LANGUAGE_OPTIONS.map(([value, messageKey]) => (
            <option key={value} value={value}>
              {t(messageKey)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export const createLearningCardEditorDraft = (card: LearningCard): LearningCardEditorDraft => {
  if ('unassigned' in card.content) {
    return {
      learningText: card.content.unassigned.text,
      learningLanguage: '',
      supportEnabled: false,
      supportText: '',
      supportLanguage: '',
    };
  }

  return {
    learningText: card.content.learning.text,
    learningLanguage: card.content.learning.language,
    supportEnabled: card.content.support !== undefined,
    supportText: card.content.support?.text ?? '',
    supportLanguage: card.content.support?.language ?? '',
  };
};

export const createEditedLearningCard = (
  card: LearningCard,
  draft: LearningCardEditorDraft
): LearningCard => {
  if (!draft.learningText.trim() || !draft.learningLanguage) {
    throw new LearningCardEditorValidationError(t('v2_library_editor_invalid'));
  }
  if (draft.supportEnabled && (!draft.supportText.trim() || !draft.supportLanguage)) {
    throw new LearningCardEditorValidationError(t('v2_library_editor_invalid'));
  }

  return learningCardSchema.parse({
    ...card,
    content: {
      learning: { text: draft.learningText, language: draft.learningLanguage },
      ...(draft.supportEnabled
        ? { support: { text: draft.supportText, language: draft.supportLanguage } }
        : {}),
    },
  });
};

const asLanguage = (value: string): Language | '' =>
  Object.prototype.hasOwnProperty.call(LANGUAGES, value) ? (value as Language) : '';

class LearningCardEditorValidationError extends Error {}
