import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  DeletedLearningCard,
  V2LearningCardStorageApi,
} from '@storage/v2/learning-card-storage';
import { LearningCard } from '@storage/v2/type';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';

import { LearningCardContent } from './learning-card-content';
import { LearningCardEditor } from './learning-card-editor';

export type LearningCardSort = 'latest' | 'oldest';
export type LearningCardStudyFilter = 'all' | LearningCard['studyState'];
export type LearningCardRoleFilter = 'all' | 'learning' | 'support' | 'unassigned';

export interface LearningCardLibraryQuery {
  role: LearningCardRoleFilter;
  searchText: string;
  sort: LearningCardSort;
  studyState: LearningCardStudyFilter;
}

interface LearningCardLibraryProps {
  refreshRevision?: number;
  storage: V2LearningCardStorageApi;
}

type FocusAction = 'delete' | 'edit' | 'state';

interface FocusRequest {
  action: FocusAction;
  cardId: string;
}

interface ActionError {
  cardId?: string;
  message: string;
}

const DEFAULT_QUERY: LearningCardLibraryQuery = {
  role: 'all',
  searchText: '',
  sort: 'latest',
  studyState: 'all',
};

export function LearningCardLibrary({ refreshRevision = 0, storage }: LearningCardLibraryProps) {
  const [cards, setCards] = useState<LearningCard[]>();
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [editingId, setEditingId] = useState<string>();
  const [pendingCardId, setPendingCardId] = useState<string>();
  const [deleted, setDeleted] = useState<DeletedLearningCard>();
  const [actionError, setActionError] = useState<ActionError>();
  const [focusRequest, setFocusRequest] = useState<FocusRequest>();
  const actionRefs = useRef<Record<FocusAction, Map<string, HTMLButtonElement | HTMLSelectElement>>>(
    {
      delete: new Map(),
      edit: new Map(),
      state: new Map(),
    }
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const handledRefreshRevisionRef = useRef(refreshRevision);
  const undoRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setCards(undefined);
    setLoadError(false);
    setActionError(undefined);
    try {
      setCards(await storage.get());
    } catch {
      setLoadError(true);
    }
  }, [storage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (handledRefreshRevisionRef.current === refreshRevision) return;
    handledRefreshRevisionRef.current = refreshRevision;
    void storage.get().then(
      (nextCards) => {
        setCards(nextCards);
        setLoadError(false);
      },
      () => {
        setCards(undefined);
        setLoadError(true);
      }
    );
  }, [refreshRevision, storage]);

  useEffect(() => {
    if (!focusRequest) return;
    const target = actionRefs.current[focusRequest.action].get(focusRequest.cardId);
    (target ?? headingRef.current)?.focus();
    setFocusRequest(undefined);
  }, [cards, editingId, focusRequest]);

  useEffect(() => {
    if (deleted) undoRef.current?.focus();
  }, [deleted]);

  const visibleCards = useMemo(
    () => (cards ? getVisibleLearningCards(cards, query) : []),
    [cards, query]
  );
  const hasActiveQuery =
    query.searchText !== '' ||
    query.sort !== DEFAULT_QUERY.sort ||
    query.studyState !== 'all' ||
    query.role !== 'all';
  const mutationPending = pendingCardId !== undefined;

  const replaceCard = (updated: LearningCard) => {
    setCards((current) =>
      current?.map((card) => (card.id === updated.id ? updated : card))
    );
  };

  const handleStateChange = async (card: LearningCard, studyState: LearningCard['studyState']) => {
    if (card.studyState === studyState || pendingCardId) return;
    setActionError(undefined);
    setPendingCardId(card.id);
    try {
      replaceCard(await storage.update(card.id, { ...card, studyState }));
      setFocusRequest({ action: 'state', cardId: card.id });
    } catch {
      setActionError({ cardId: card.id, message: t('v2_library_update_error') });
    } finally {
      setPendingCardId(undefined);
    }
  };

  const handleSave = async (card: LearningCard) => {
    if (pendingCardId) throw new Error('A card mutation is already pending');
    setActionError(undefined);
    setPendingCardId(card.id);
    try {
      replaceCard(await storage.update(card.id, card));
      setEditingId(undefined);
      setFocusRequest({ action: 'edit', cardId: card.id });
    } finally {
      setPendingCardId(undefined);
    }
  };

  const handleDelete = async (card: LearningCard) => {
    if (pendingCardId) return;
    setActionError(undefined);
    setPendingCardId(card.id);
    try {
      const deletion = await storage.delete(card.id);
      setCards((current) => removeLearningCard(current, card.id));
      setDeleted(deletion);
      if (editingId === card.id) setEditingId(undefined);
    } catch {
      setActionError({ cardId: card.id, message: t('v2_library_delete_error') });
    } finally {
      setPendingCardId(undefined);
    }
  };

  const handleRestore = async () => {
    if (!deleted || pendingCardId) return;
    setActionError(undefined);
    setPendingCardId(deleted.card.id);
    try {
      const restored = await storage.restore(deleted);
      setCards((current) => insertLearningCard(current, restored, deleted.index));
      setDeleted(undefined);
      setFocusRequest({ action: 'delete', cardId: restored.id });
    } catch {
      setActionError({ message: t('v2_library_restore_error') });
    } finally {
      setPendingCardId(undefined);
    }
  };

  if (!cards) {
    return loadError ? <LibraryLoadError onRetry={load} /> : <LibraryLoading />;
  }

  return (
    <section
      className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-4 py-4'
      aria-labelledby='v2-learning-library-title'
    >
      <header className='flex shrink-0 flex-col gap-3 border-b pb-3'>
        <div className='flex items-center justify-between gap-2'>
          <h1
            ref={headingRef}
            id='v2-learning-library-title'
            tabIndex={-1}
            className='text-lg font-semibold outline-none'
          >
            {t('v2_library_title')}
          </h1>
          <span className='text-sm text-muted-foreground'>{visibleCards.length} / {cards.length}</span>
        </div>
        {cards.length > 0 && (
          <LibraryControls
            disabled={mutationPending}
            query={query}
            canClear={hasActiveQuery}
            onChange={setQuery}
            onClear={() => setQuery(DEFAULT_QUERY)}
          />
        )}
      </header>

      {deleted && (
        <div className='flex shrink-0 items-center justify-between gap-2 border-b py-2' role='status'>
          <span className='text-wrap text-sm'>{t('v2_library_deleted')}</span>
          <div className='flex shrink-0 gap-1'>
            <Button
              ref={undoRef}
              type='button'
              variant='outline'
              size='sm'
              disabled={pendingCardId !== undefined}
              aria-label={t('v2_library_restore')}
              onClick={() => void handleRestore()}
            >
              {t('undo')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={pendingCardId !== undefined}
              aria-label={t('v2_library_dismiss_undo')}
              onClick={() => setDeleted(undefined)}
            >
              ×
            </Button>
          </div>
        </div>
      )}

      {actionError && actionError.cardId === undefined && (
        <p role='alert' className='shrink-0 py-2 text-wrap text-sm text-destructive'>
          {actionError.message}
        </p>
      )}

      {cards.length === 0 ? (
        <LibraryEmpty />
      ) : visibleCards.length === 0 ? (
        <LibraryFilteredEmpty onClear={() => setQuery(DEFAULT_QUERY)} />
      ) : (
        <ul
          className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-2'
          data-scroll-owner='learning-library'
        >
          {visibleCards.map((card) => {
            const pending = pendingCardId === card.id;
            const editing = editingId === card.id;
            return (
              <li key={card.id} className='min-w-0 border-b py-3'>
                <article
                  className='flex min-w-0 flex-col gap-3'
                  aria-busy={pending}
                  aria-labelledby={`${card.id}-library-card-title`}
                >
                  <h2 id={`${card.id}-library-card-title`} className='sr-only'>
                    {getLearningCardSearchText(card)}
                  </h2>
                  <LearningCardContent card={card} />
                  <LearningCardProvenance card={card} />

                  {editing ? (
                    <LearningCardEditor
                      card={card}
                      disabled={mutationPending}
                      pending={pending}
                      onCancel={() => {
                        setEditingId(undefined);
                        setActionError(undefined);
                        setFocusRequest({ action: 'edit', cardId: card.id });
                      }}
                      onSave={handleSave}
                    />
                  ) : (
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                      <label className='min-w-0 flex-1 text-xs font-medium'>
                        <span className='sr-only'>{t('v2_library_state_change')}</span>
                        <select
                          ref={(element) => setActionRef(actionRefs.current.state, card.id, element)}
                          className='h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:opacity-50'
                          value={card.studyState}
                          disabled={pendingCardId !== undefined}
                          aria-label={t('v2_library_state_change')}
                          onChange={(event) =>
                            void handleStateChange(card, asStudyState(event.target.value))
                          }
                        >
                          <option value='active'>{t('v2_library_active')}</option>
                          <option value='completed'>{t('v2_library_completed')}</option>
                        </select>
                      </label>
                      <Button
                        ref={(element) => setActionRef(actionRefs.current.edit, card.id, element)}
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={pendingCardId !== undefined}
                        onClick={() => {
                          setActionError(undefined);
                          setEditingId(card.id);
                        }}
                      >
                        {t('edit')}
                      </Button>
                      <Button
                        ref={(element) => setActionRef(actionRefs.current.delete, card.id, element)}
                        type='button'
                        variant='outline'
                        size='sm'
                        disabled={pendingCardId !== undefined || deleted !== undefined}
                        onClick={() => void handleDelete(card)}
                      >
                        {t('delete')}
                      </Button>
                    </div>
                  )}

                  {pending && !editing && (
                    <p role='status' className='text-sm text-muted-foreground'>
                      {t('v2_library_save_pending')}
                    </p>
                  )}
                  {actionError?.cardId === card.id && (
                    <p role='alert' className='text-wrap text-sm text-destructive'>
                      {actionError.message}
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface LibraryControlsProps {
  canClear: boolean;
  disabled: boolean;
  query: LearningCardLibraryQuery;
  onChange: (query: LearningCardLibraryQuery) => void;
  onClear: () => void;
}

function LibraryControls({ canClear, disabled, query, onChange, onClear }: LibraryControlsProps) {
  return (
    <div className='flex min-w-0 flex-col gap-2'>
      <Input
        type='search'
        aria-label={t('v2_library_search_label')}
        disabled={disabled}
        value={query.searchText}
        onChange={(event) => {
          if (!disabled) onChange({ ...query, searchText: event.target.value });
        }}
      />
      <div className='grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2 min-[390px]:grid-cols-3'>
        <label className='min-w-0 text-xs font-medium'>
          <span className='sr-only'>{t('v2_library_sort_label')}</span>
          <select
            className='h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50'
            value={query.sort}
            disabled={disabled}
            aria-label={t('v2_library_sort_label')}
            onChange={(event) => {
              if (!disabled) onChange({ ...query, sort: asSort(event.target.value) });
            }}
          >
            <option value='latest'>{t('latest')}</option>
            <option value='oldest'>{t('oldest')}</option>
          </select>
        </label>
        <label className='min-w-0 text-xs font-medium'>
          <span className='sr-only'>{t('v2_library_state_filter')}</span>
          <select
            className='h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50'
            value={query.studyState}
            disabled={disabled}
            aria-label={t('v2_library_state_filter')}
            onChange={(event) => {
              if (!disabled) {
                onChange({ ...query, studyState: asStudyFilter(event.target.value) });
              }
            }}
          >
            <option value='all'>{t('v2_library_all')}</option>
            <option value='active'>{t('v2_library_active')}</option>
            <option value='completed'>{t('v2_library_completed')}</option>
          </select>
        </label>
        <label className='min-w-0 text-xs font-medium'>
          <span className='sr-only'>{t('v2_library_role_filter')}</span>
          <select
            className='h-8 w-full min-w-0 rounded-md border bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50'
            value={query.role}
            disabled={disabled}
            aria-label={t('v2_library_role_filter')}
            onChange={(event) => {
              if (!disabled) onChange({ ...query, role: asRoleFilter(event.target.value) });
            }}
          >
            <option value='all'>{t('v2_library_all')}</option>
            <option value='learning'>{t('v2_library_learning')}</option>
            <option value='support'>{t('v2_library_contains_support')}</option>
            <option value='unassigned'>{t('v2_library_unassigned')}</option>
          </select>
        </label>
      </div>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={disabled || !canClear}
        onClick={onClear}
      >
        {t('clear_filters')}
      </Button>
    </div>
  );
}

function LearningCardProvenance({ card }: { card: LearningCard }) {
  const time =
    card.source.endTime === undefined
      ? `${card.source.startTime}s`
      : `${card.source.startTime}s–${card.source.endTime}s`;

  return (
    <dl className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs text-muted-foreground'>
      <dt>{t('v2_library_source')}</dt>
      <dd className='min-w-0 break-words [overflow-wrap:anywhere]'>
        {card.source.title ? `${card.source.title} · ${card.source.url}` : card.source.url}
      </dd>
      <dt>{t('v2_library_time')}</dt>
      <dd>{time}</dd>
      <dt>{t('v2_library_created')}</dt>
      <dd>{new Date(card.createdAt).toLocaleString()}</dd>
    </dl>
  );
}

function LibraryLoading() {
  return (
    <div className='flex h-full items-center justify-center p-4 text-sm text-muted-foreground' role='status'>
      {t('v2_library_loading')}
    </div>
  );
}

function LibraryLoadError({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 p-4 text-center'>
      <p role='alert' className='text-wrap text-sm text-destructive'>
        {t('v2_library_load_error')}
      </p>
      <Button type='button' variant='outline' onClick={() => void onRetry()}>
        {t('v2_library_retry')}
      </Button>
    </div>
  );
}

function LibraryEmpty() {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-4 text-center'>
      <h2 className='text-base font-semibold'>{t('v2_library_empty_title')}</h2>
      <p className='text-wrap text-sm text-muted-foreground'>{t('v2_library_empty_description')}</p>
    </div>
  );
}

function LibraryFilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center'>
      <p className='text-wrap text-sm text-muted-foreground'>{t('v2_library_filtered_empty')}</p>
      <Button type='button' variant='outline' size='sm' onClick={onClear}>
        {t('clear_filters')}
      </Button>
    </div>
  );
}

export const getVisibleLearningCards = (
  cards: LearningCard[],
  query: LearningCardLibraryQuery
): LearningCard[] => {
  const searchText = query.searchText.trim().toLocaleLowerCase();
  return cards
    .map((card, originalIndex) => ({ card, originalIndex }))
    .filter(({ card }) => {
      if (query.studyState !== 'all' && card.studyState !== query.studyState) return false;
      if (!matchesRole(card, query.role)) return false;
      return !searchText || getLearningCardSearchText(card).toLocaleLowerCase().includes(searchText);
    })
    .sort((left, right) => {
      const timeDifference =
        new Date(left.card.createdAt).getTime() - new Date(right.card.createdAt).getTime();
      const orderedDifference = query.sort === 'oldest' ? timeDifference : -timeDifference;
      return orderedDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ card }) => card);
};

export const getLearningCardSearchText = (card: LearningCard) => {
  if ('unassigned' in card.content) return card.content.unassigned.text;
  return [card.content.learning.text, card.content.support?.text].filter(Boolean).join('\n');
};

const matchesRole = (card: LearningCard, role: LearningCardRoleFilter) => {
  if (role === 'all') return true;
  if (role === 'unassigned') return 'unassigned' in card.content;
  if ('unassigned' in card.content) return false;
  return role === 'learning' || card.content.support !== undefined;
};

const removeLearningCard = (cards: LearningCard[] | undefined, id: string) => {
  if (!cards) return cards;
  const index = cards.findIndex((card) => card.id === id);
  if (index < 0) return cards;
  return [...cards.slice(0, index), ...cards.slice(index + 1)];
};

const insertLearningCard = (
  cards: LearningCard[] | undefined,
  card: LearningCard,
  index: number
) => {
  if (!cards) return cards;
  const insertionIndex = Math.min(index, cards.length);
  return [...cards.slice(0, insertionIndex), card, ...cards.slice(insertionIndex)];
};

const setActionRef = <T extends HTMLElement>(map: Map<string, T>, id: string, element: T | null) => {
  if (element) map.set(id, element);
  else map.delete(id);
};

const asSort = (value: string): LearningCardSort => (value === 'oldest' ? 'oldest' : 'latest');

const asStudyState = (value: string): LearningCard['studyState'] =>
  value === 'completed' ? 'completed' : 'active';

const asStudyFilter = (value: string): LearningCardStudyFilter =>
  value === 'active' || value === 'completed' ? value : 'all';

const asRoleFilter = (value: string): LearningCardRoleFilter =>
  value === 'learning' || value === 'support' || value === 'unassigned' ? value : 'all';
