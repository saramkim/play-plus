import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { V2LearningCardStorageApi } from '@storage/v2/learning-card-storage';
import { LearningCard } from '@storage/v2/type';
import { t } from '@utils/i18n';
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
} from 'lucide-react';

import { Button } from '@/ui/components/button';
import {
  LearningCardContent,
  LearningCardSupportContent,
} from '@/ui/features/learning-library/learning-card-content';

export type FocusedReviewSessionKind = LearningCard['studyState'];
export type FocusedReviewStorage = Pick<V2LearningCardStorageApi, 'get' | 'update'>;
export type OpenOriginalVideoTarget = Pick<LearningCard['source'], 'startTime' | 'url'>;

interface FocusedReviewProps {
  storage: FocusedReviewStorage;
  refreshRevision?: number;
  onOpenLibrary: () => void;
  onOpenOriginalVideo: (target: OpenOriginalVideoTarget) => void;
}

interface FocusedReviewSession {
  cards: LearningCard[];
  currentIndex: number;
  generation: number;
  kind: FocusedReviewSessionKind;
}

type LoadStatus = 'error' | 'loading' | 'ready';

export const getFocusedReviewQueue = (
  cards: LearningCard[],
  kind: FocusedReviewSessionKind
): LearningCard[] =>
  cards.filter((card) => 'learning' in card.content && card.studyState === kind);

export function FocusedReview({
  storage,
  refreshRevision = 0,
  onOpenLibrary,
  onOpenOriginalVideo,
}: FocusedReviewProps) {
  const [requestedKind, setRequestedKind] = useState<FocusedReviewSessionKind>('active');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [session, setSession] = useState<FocusedReviewSession>();
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const generationRef = useRef(0);
  const handledRefreshRevisionRef = useRef(refreshRevision);
  const operationRef = useRef(0);
  const pendingRef = useRef(false);
  const sessionRef = useRef<FocusedReviewSession | undefined>(undefined);
  const failureFocusRef = useRef<HTMLButtonElement | undefined>(undefined);

  const loadSession = useCallback(
    async (kind: FocusedReviewSessionKind) => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      operationRef.current += 1;
      pendingRef.current = false;
      sessionRef.current = undefined;
      failureFocusRef.current = undefined;
      setRequestedKind(kind);
      setLoadStatus('loading');
      setSession(undefined);
      setPending(false);
      setActionError(undefined);

      try {
        const cards = await storage.get();
        if (generationRef.current !== generation) return;
        const nextSession = {
          cards: getFocusedReviewQueue(cards, kind),
          currentIndex: 0,
          generation,
          kind,
        };
        sessionRef.current = nextSession;
        setSession(nextSession);
        setLoadStatus('ready');
      } catch {
        if (generationRef.current !== generation) return;
        setLoadStatus('error');
      }
    },
    [storage]
  );

  const refreshSession = useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;

    try {
      const cards = getFocusedReviewQueue(await storage.get(), current.kind);
      if (sessionRef.current !== current) return;
      const currentCardId = current.cards[current.currentIndex]?.id;
      const matchingIndex = currentCardId
        ? cards.findIndex((card) => card.id === currentCardId)
        : -1;
      const nextSession = {
        ...current,
        cards,
        currentIndex:
          matchingIndex >= 0
            ? matchingIndex
            : Math.min(current.currentIndex, cards.length),
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
      setLoadStatus('ready');
    } catch {
      if (sessionRef.current !== current) return;
      sessionRef.current = undefined;
      setSession(undefined);
      setLoadStatus('error');
    }
  }, [storage]);

  useEffect(() => {
    void loadSession('active');
    return () => {
      generationRef.current += 1;
      operationRef.current += 1;
      pendingRef.current = false;
      sessionRef.current = undefined;
    };
  }, [loadSession]);

  useEffect(() => {
    if (pending || handledRefreshRevisionRef.current === refreshRevision) return;
    handledRefreshRevisionRef.current = refreshRevision;
    void refreshSession();
  }, [pending, refreshRevision, refreshSession]);

  useEffect(() => {
    if (pending || !actionError || !failureFocusRef.current) return;
    failureFocusRef.current.focus();
    failureFocusRef.current = undefined;
  }, [actionError, pending]);

  const startSession = (kind: FocusedReviewSessionKind) => {
    if (pendingRef.current || loadStatus === 'loading') return;
    void loadSession(kind);
  };

  const moveTo = (currentIndex: number) => {
    const current = sessionRef.current;
    if (pendingRef.current || !current) return;
    if (currentIndex < 0 || currentIndex > current.cards.length) return;
    const nextSession = { ...current, currentIndex };
    sessionRef.current = nextSession;
    setSession(nextSession);
    setActionError(undefined);
  };

  const handleJudgment = async (
    studyState: LearningCard['studyState'],
    trigger: HTMLButtonElement
  ) => {
    const current = sessionRef.current;
    const card = current?.cards[current.currentIndex];
    if (pendingRef.current || !current || !card) return;

    const operation = operationRef.current + 1;
    operationRef.current = operation;
    pendingRef.current = true;
    failureFocusRef.current = undefined;
    setPending(true);
    setActionError(undefined);

    try {
      const updated = await storage.update(card.id, { ...card, studyState });
      if (!isCurrentOperation(current, card.id, operation, generationRef, operationRef, sessionRef)) {
        return;
      }
      if (
        updated.id !== card.id ||
        updated.studyState !== studyState ||
        'unassigned' in updated.content
      ) {
        throw new Error('The learning card update returned an invalid Review card');
      }

      const nextCards = [...current.cards];
      nextCards[current.currentIndex] = updated;
      const nextSession = {
        ...current,
        cards: nextCards,
        currentIndex: current.currentIndex + 1,
      };
      sessionRef.current = nextSession;
      setSession(nextSession);
    } catch {
      if (!isCurrentOperation(current, card.id, operation, generationRef, operationRef, sessionRef)) {
        return;
      }
      failureFocusRef.current = trigger;
      setActionError(t('v2_review_update_error'));
    } finally {
      if (generationRef.current === current.generation && operationRef.current === operation) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  };

  const controlsDisabled = pending || loadStatus === 'loading';
  const currentCard = session?.cards[session.currentIndex];
  const showHeaderLibrary = !(loadStatus === 'ready' && session && !currentCard);

  return (
    <section
      className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-4 py-4'
      aria-labelledby='v2-focused-review-title'
    >
      <header className='flex shrink-0 flex-col gap-3 border-b pb-3'>
        <h1 id='v2-focused-review-title' className='text-lg font-semibold'>
          {t('v2_review_title')}
        </h1>
        <div className='grid min-w-0 grid-cols-2 gap-2 min-[390px]:grid-cols-3'>
          <div
            className='col-span-2 grid min-w-0 grid-cols-2 gap-2'
            role='group'
            aria-label={t('v2_review_session_label')}
          >
            <Button
              type='button'
              size='sm'
              variant={requestedKind === 'active' ? 'secondary' : 'outline'}
              disabled={controlsDisabled}
              aria-pressed={requestedKind === 'active'}
              onClick={() => startSession('active')}
            >
              {t('v2_review_active_session')}
            </Button>
            <Button
              type='button'
              size='sm'
              variant={requestedKind === 'completed' ? 'secondary' : 'outline'}
              disabled={controlsDisabled}
              aria-pressed={requestedKind === 'completed'}
              onClick={() => startSession('completed')}
            >
              {t('v2_review_completed_session')}
            </Button>
          </div>
          {showHeaderLibrary && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='col-span-2 min-w-0 min-[390px]:col-span-1'
              disabled={controlsDisabled}
              onClick={() => {
                if (!pendingRef.current) onOpenLibrary();
              }}
            >
              {t('v2_review_open_library')}
            </Button>
          )}
        </div>
      </header>

      <div
        className='flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pt-3'
        data-scroll-owner='focused-review'
        aria-busy={loadStatus === 'loading'}
      >
        {loadStatus === 'loading' ? (
          <ReviewLoading />
        ) : loadStatus === 'error' ? (
          <ReviewLoadError onRetry={() => loadSession(requestedKind)} />
        ) : session && currentCard ? (
          <FocusedCard
            key={`${session.generation}:${session.currentIndex}:${currentCard.id}`}
            card={currentCard}
            currentIndex={session.currentIndex}
            total={session.cards.length}
            pending={pending}
            error={actionError}
            onOpenOriginalVideo={(target) => {
              if (!pendingRef.current) onOpenOriginalVideo(target);
            }}
            onPrevious={() => moveTo(session.currentIndex - 1)}
            onSkip={() => moveTo(session.currentIndex + 1)}
            onJudgment={handleJudgment}
          />
        ) : session ? (
          <ReviewEndState
            key={`${session.generation}:${session.cards.length === 0 ? 'empty' : 'finished'}`}
            empty={session.cards.length === 0}
            kind={session.kind}
            onOpenLibrary={onOpenLibrary}
          />
        ) : null}
      </div>
    </section>
  );
}

interface FocusedCardProps {
  card: LearningCard;
  currentIndex: number;
  error?: string;
  pending: boolean;
  total: number;
  onJudgment: (
    studyState: LearningCard['studyState'],
    trigger: HTMLButtonElement
  ) => Promise<void>;
  onOpenOriginalVideo: (target: OpenOriginalVideoTarget) => void;
  onPrevious: () => void;
  onSkip: () => void;
}

function FocusedCard({
  card,
  currentIndex,
  error,
  pending,
  total,
  onJudgment,
  onOpenOriginalVideo,
  onPrevious,
  onSkip,
}: FocusedCardProps) {
  const [supportVisible, setSupportVisible] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const supportRegionId = useId();
  const progress = t('v2_review_progress', String(currentIndex + 1), String(total));
  const hasSupport = 'learning' in card.content && card.content.support !== undefined;

  useEffect(() => articleRef.current?.focus(), []);

  return (
    <div className='flex min-w-0 flex-col gap-3 pb-2'>
      <div className='shrink-0' aria-label={progress}>
        <div className='mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
          <span>{t(card.studyState === 'active' ? 'v2_library_active' : 'v2_library_completed')}</span>
          <span className='font-medium text-foreground'>
            {currentIndex + 1} / {total}
          </span>
        </div>
        <div
          className='h-1 overflow-hidden rounded-full bg-muted'
          role='progressbar'
          aria-label={progress}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={currentIndex + 1}
          aria-valuetext={progress}
        >
          <div
            className='h-full rounded-full bg-primary transition-[width]'
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {pending && (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('v2_review_save_pending')}
        </p>
      )}
      {error && (
        <p role='alert' className='text-wrap text-sm text-destructive'>
          {error}
        </p>
      )}

      <article
        ref={articleRef}
        tabIndex={-1}
        className='flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs outline-none focus-visible:ring-1 focus-visible:ring-ring'
        aria-labelledby={headingId}
        aria-busy={pending}
      >
        <h2 id={headingId} className='sr-only'>
          {progress}
        </h2>

        <LearningCardContent card={card} showSupport={false} />

        {hasSupport && (
          <>
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-auto min-h-8 min-w-0 whitespace-normal py-2 text-center'
              disabled={pending}
              aria-expanded={supportVisible}
              aria-controls={supportRegionId}
              onClick={() => setSupportVisible((visible) => !visible)}
            >
              {supportVisible ? <EyeOffIcon /> : <EyeIcon />}
              {t(supportVisible ? 'v2_review_hide_support' : 'v2_review_show_support')}
            </Button>
            <div
              id={supportRegionId}
              className='min-w-0'
              aria-live='polite'
              hidden={!supportVisible}
            >
              {supportVisible && <LearningCardSupportContent card={card} />}
            </div>
          </>
        )}

        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-auto min-h-8 min-w-0 whitespace-normal py-2 text-center'
          disabled={pending}
          onClick={() =>
            onOpenOriginalVideo({
              url: card.source.url,
              startTime: card.source.startTime,
            })
          }
        >
          <ExternalLinkIcon />
          {t('v2_review_open_video')}
        </Button>

        <div
          className='grid min-w-0 grid-cols-2 gap-2'
          role='group'
          aria-label={t('v2_review_navigation_label')}
        >
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-auto min-h-8 min-w-0 whitespace-normal py-2 text-center'
            disabled={currentIndex === 0 || pending}
            onClick={onPrevious}
          >
            <ChevronLeftIcon />
            {t('v2_review_previous')}
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-auto min-h-8 min-w-0 whitespace-normal py-2 text-center'
            disabled={pending}
            onClick={onSkip}
          >
            {t('v2_review_skip')}
            <ChevronRightIcon />
          </Button>
        </div>

        <div
          className='grid min-w-0 grid-cols-2 gap-2'
          role='group'
          aria-label={t('v2_review_judgment_label')}
        >
          <Button
            type='button'
            variant='secondary'
            size='sm'
            className='h-auto min-h-8 min-w-0 whitespace-normal py-2 text-center'
            disabled={pending}
            onClick={(event) => void onJudgment('active', event.currentTarget)}
          >
            <RotateCcwIcon />
            {t('v2_review_keep_learning')}
          </Button>
          <Button
            type='button'
            size='sm'
            className='h-auto min-h-8 min-w-0 whitespace-normal py-2 text-center'
            disabled={pending}
            onClick={(event) => void onJudgment('completed', event.currentTarget)}
          >
            <CheckIcon />
            {t('v2_review_complete')}
          </Button>
        </div>
      </article>
    </div>
  );
}

function ReviewLoading() {
  return (
    <div className='flex min-h-0 flex-1 items-center justify-center p-4 text-center' role='status'>
      <p className='text-sm text-muted-foreground'>{t('v2_review_loading')}</p>
    </div>
  );
}

function ReviewLoadError({ onRetry }: { onRetry: () => Promise<void> }) {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center'>
      <p role='alert' className='text-wrap text-sm text-destructive'>
        {t('v2_review_load_error')}
      </p>
      <Button type='button' variant='outline' onClick={() => void onRetry()}>
        {t('v2_review_retry')}
      </Button>
    </div>
  );
}

interface ReviewEndStateProps {
  empty: boolean;
  kind: FocusedReviewSessionKind;
  onOpenLibrary: () => void;
}

function ReviewEndState({ empty, kind, onOpenLibrary }: ReviewEndStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const title = empty
    ? t(kind === 'active' ? 'v2_review_active_empty_title' : 'v2_review_completed_empty_title')
    : t('v2_review_finished_title');
  const description = empty
    ? t(
        kind === 'active'
          ? 'v2_review_active_empty_description'
          : 'v2_review_completed_empty_description'
      )
    : t('v2_review_finished_description');

  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center'>
      <h2 ref={headingRef} tabIndex={-1} className='text-base font-semibold outline-none'>
        {title}
      </h2>
      <p className='text-wrap text-sm leading-relaxed text-muted-foreground'>{description}</p>
      <Button type='button' variant='outline' onClick={onOpenLibrary}>
        {t('v2_review_open_library')}
      </Button>
    </div>
  );
}

function isCurrentOperation(
  capturedSession: FocusedReviewSession,
  cardId: string,
  operation: number,
  generationRef: React.RefObject<number>,
  operationRef: React.RefObject<number>,
  sessionRef: React.RefObject<FocusedReviewSession | undefined>
) {
  const current = sessionRef.current;
  return (
    generationRef.current === capturedSession.generation &&
    operationRef.current === operation &&
    current?.generation === capturedSession.generation &&
    current.currentIndex === capturedSession.currentIndex &&
    current.cards[current.currentIndex]?.id === cardId
  );
}
