import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { getSavedSubtitleSearchText } from '@storage/saved-subtitle';
import { SavedSubtitle, SavedSubtitleReviewStatus } from '@storage/type';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message/index';
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import { CopyButton } from '@/ui/components/copy-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/ui/components/toggle-group';
import { ListHeader } from '@/ui/features/subtitle/list-header';
import {
  filterSavedSubtitlesByReviewStatus,
  isReviewStatusFilter,
  isSavedSubtitleReviewStatus,
  REVIEW_STATUS_FILTERS,
  ReviewStatusFilter,
} from '@/ui/features/subtitle/review-status-filter';
import { useSavedSubtitle } from '@/ui/features/subtitle/use-saved-subtitle';

const REVIEW_STATUS_LABELS = {
  all: 'review_status_all',
  new: 'review_status_new',
  learning: 'review_status_learning',
  mastered: 'review_status_mastered',
} as const;

const REVIEW_STATUS_DESCRIPTIONS = {
  new: 'review_status_new_description',
  learning: 'review_status_learning_description',
  mastered: 'review_status_mastered_description',
} as const;

const REVIEW_STATUS_STYLES = {
  new: 'bg-muted text-muted-foreground',
  learning: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  mastered: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
} as const;

const REVIEW_STATUS_ACTIONS = {
  new: {
    continue: { label: 'review_start_learning', reviewStatus: 'learning' },
    complete: { label: 'review_already_know', reviewStatus: 'mastered' },
  },
  learning: {
    continue: { label: 'review_keep_learning', reviewStatus: 'learning' },
    complete: { label: 'review_remember', reviewStatus: 'mastered' },
  },
  mastered: {
    continue: { label: 'review_learn_again', reviewStatus: 'learning' },
    complete: { label: 'review_still_remember', reviewStatus: 'mastered' },
  },
} as const;

const REVIEW_MODES = ['review', 'library'] as const;
type ReviewMode = (typeof REVIEW_MODES)[number];
type ReviewSessionKind = 'pending' | 'mastered';

interface ReviewSession {
  cards: SavedSubtitle[];
  currentIndex: number;
  kind: ReviewSessionKind;
  statusOverrides: Record<string, SavedSubtitleReviewStatus>;
}

export function ReviewPage() {
  const [mode, setMode] = useState<ReviewMode>('review');
  const [session, setSession] = useState<ReviewSession>();
  const { subtitles, deleteSubtitle, updateReviewStatus, loading } = useSavedSubtitle();

  useEffect(() => {
    if (!loading && !session) setSession(createReviewSession(subtitles, 'pending'));
  }, [loading, session, subtitles]);

  const startSession = (kind: ReviewSessionKind) => {
    setSession(createReviewSession(subtitles, kind));
    setMode('review');
  };

  const handleModeChange = (nextMode: string) => {
    if (!isReviewMode(nextMode) || nextMode === mode) return;
    if (nextMode === 'review') startSession('pending');
    else setMode('library');
  };

  if (loading || !session) return <LoadingState />;

  return (
    <div className='flex h-full min-h-0 flex-col gap-3 px-4 py-4'>
      <ReviewModeSwitch value={mode} onChange={handleModeChange} />
      {subtitles.length === 0 ? (
        <EmptyState />
      ) : mode === 'review' ? (
        <ReviewSessionPanel
          session={session}
          canReviewCompleted={subtitles.some(({ reviewStatus }) => reviewStatus === 'mastered')}
          onCurrentIndexChange={(currentIndex) => {
            setSession((current) => (current ? { ...current, currentIndex } : current));
          }}
          onOpenLibrary={() => setMode('library')}
          onReviewCompleted={() => startSession('mastered')}
          onReviewStatusChange={updateReviewStatus}
          onReviewStatusSaved={(id, reviewStatus) => {
            setSession((current) =>
              current
                ? {
                    ...current,
                    statusOverrides: { ...current.statusOverrides, [id]: reviewStatus },
                  }
                : current
            );
          }}
        />
      ) : (
        <SubtitleLibrary
          subtitles={subtitles}
          onDelete={deleteSubtitle}
          onReviewStatusChange={updateReviewStatus}
        />
      )}
    </div>
  );
}

interface ReviewModeSwitchProps {
  value: ReviewMode;
  onChange: (value: string) => void;
}

function ReviewModeSwitch({ value, onChange }: ReviewModeSwitchProps) {
  return (
    <ToggleGroup
      type='single'
      value={value}
      variant='outline'
      className='w-full shrink-0'
      aria-label={t('review_mode')}
      onValueChange={onChange}
    >
      <ToggleGroupItem value='review'>{t('review_mode_session')}</ToggleGroupItem>
      <ToggleGroupItem value='library'>{t('review_mode_library')}</ToggleGroupItem>
    </ToggleGroup>
  );
}

interface ReviewSessionPanelProps {
  session: ReviewSession;
  canReviewCompleted: boolean;
  onCurrentIndexChange: (index: number) => void;
  onOpenLibrary: () => void;
  onReviewCompleted: () => void;
  onReviewStatusChange: (
    id: string,
    reviewStatus: SavedSubtitleReviewStatus
  ) => Promise<SavedSubtitle | undefined>;
  onReviewStatusSaved: (id: string, reviewStatus: SavedSubtitleReviewStatus) => void;
}

function ReviewSessionPanel({
  session,
  canReviewCompleted,
  onCurrentIndexChange,
  onOpenLibrary,
  onReviewCompleted,
  onReviewStatusChange,
  onReviewStatusSaved,
}: ReviewSessionPanelProps) {
  const currentCard = session.cards[session.currentIndex];
  const pendingStatusCounts = session.cards.reduce(
    (counts, card) => {
      const reviewStatus = session.statusOverrides[card.id] ?? card.reviewStatus;
      if (reviewStatus === 'new' || reviewStatus === 'learning') counts[reviewStatus] += 1;
      return counts;
    },
    { new: 0, learning: 0 }
  );

  if (!currentCard) {
    return (
      <ReviewSessionEnd
        hadCards={session.cards.length > 0}
        kind={session.kind}
        canReviewCompleted={canReviewCompleted}
        onOpenLibrary={onOpenLibrary}
        onReviewCompleted={onReviewCompleted}
      />
    );
  }

  const currentReviewStatus = session.statusOverrides[currentCard.id] ?? currentCard.reviewStatus;

  return (
    <ReviewCard
      card={currentCard}
      reviewStatus={currentReviewStatus}
      currentIndex={session.currentIndex}
      total={session.cards.length}
      pendingStatusCounts={session.kind === 'pending' ? pendingStatusCounts : undefined}
      onPrevious={() => onCurrentIndexChange(session.currentIndex - 1)}
      onNext={() => onCurrentIndexChange(session.currentIndex + 1)}
      onReviewStatusChange={onReviewStatusChange}
      onReviewStatusSaved={onReviewStatusSaved}
    />
  );
}

interface ReviewCardProps {
  card: SavedSubtitle;
  reviewStatus: SavedSubtitleReviewStatus;
  currentIndex: number;
  total: number;
  pendingStatusCounts?: { new: number; learning: number };
  onPrevious: () => void;
  onNext: () => void;
  onReviewStatusChange: (
    id: string,
    reviewStatus: SavedSubtitleReviewStatus
  ) => Promise<SavedSubtitle | undefined>;
  onReviewStatusSaved: (id: string, reviewStatus: SavedSubtitleReviewStatus) => void;
}

function ReviewCard({
  card,
  reviewStatus,
  currentIndex,
  total,
  pendingStatusCounts,
  onPrevious,
  onNext,
  onReviewStatusChange,
  onReviewStatusSaved,
}: ReviewCardProps) {
  const [isSecondaryVisible, setIsSecondaryVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const hasRenderedCard = useRef(false);
  const primaryId = useId();
  const secondaryId = useId();
  const statusActions = REVIEW_STATUS_ACTIONS[reviewStatus];
  const ContinueIcon = reviewStatus === 'new' ? BookOpenIcon : RotateCcwIcon;

  useEffect(() => {
    setIsSecondaryVisible(false);
    if (hasRenderedCard.current) cardRef.current?.focus();
    else hasRenderedCard.current = true;
  }, [card.id]);

  const handleJudgment = async (reviewStatus: SavedSubtitleReviewStatus) => {
    setIsSaving(true);
    try {
      const updated = await onReviewStatusChange(card.id, reviewStatus);
      if (!updated) {
        toast.error(t('review_status_update_failed'));
        return;
      }
      onReviewStatusSaved(card.id, updated.reviewStatus);
      onNext();
    } catch {
      toast.error(t('review_status_update_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className='flex min-h-0 flex-1 flex-col gap-3' aria-labelledby={primaryId} aria-busy={isSaving}>
      <div className='shrink-0' aria-label={t('review_progress', String(currentIndex + 1), String(total))}>
        <div className='mb-1 flex items-center justify-between text-xs text-muted-foreground'>
          <span>
            {pendingStatusCounts
              ? t(
                  'review_queue_summary',
                  String(pendingStatusCounts.learning),
                  String(pendingStatusCounts.new)
                )
              : t('review_completed_session')}
          </span>
          <span className='font-medium text-foreground'>
            {currentIndex + 1} / {total}
          </span>
        </div>
        <div
          className='h-1 overflow-hidden rounded-full bg-muted'
          role='progressbar'
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={currentIndex + 1}
        >
          <div
            className='h-full rounded-full bg-primary transition-[width]'
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <article
        ref={cardRef}
        tabIndex={-1}
        className='flex min-h-0 flex-1 flex-col justify-center gap-4 overflow-auto rounded-xl border bg-card p-4 shadow-xs focus-visible:ring-1 focus-visible:ring-ring'
      >
        <div className='flex flex-col items-start gap-1'>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_STYLES[reviewStatus]}`}
          >
            {t(REVIEW_STATUS_LABELS[reviewStatus])}
          </span>
          <p className='text-wrap text-xs leading-relaxed text-muted-foreground'>
            {t(REVIEW_STATUS_DESCRIPTIONS[reviewStatus])}
          </p>
        </div>

        <p id={primaryId} className='select-text text-wrap text-lg font-medium leading-relaxed'>
          {card.primary.text}
        </p>

        {card.secondary && (
          <div className='flex min-w-0 flex-col gap-2'>
            {isSecondaryVisible && (
              <p
                id={secondaryId}
                className='select-text text-wrap rounded-lg bg-muted/60 p-3 text-[15px] leading-relaxed text-muted-foreground'
              >
                {card.secondary.text}
              </p>
            )}
            <Button
              variant='outline'
              size='sm'
              className='w-full'
              aria-expanded={isSecondaryVisible}
              aria-controls={secondaryId}
              onClick={() => setIsSecondaryVisible((visible) => !visible)}
            >
              {isSecondaryVisible ? <EyeOffIcon /> : <EyeIcon />}
              {t(isSecondaryVisible ? 'review_hide_second_subtitle' : 'review_show_second_subtitle')}
            </Button>
          </div>
        )}

        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
          <Button
            variant='outline'
            size='sm'
            className='min-w-0'
            onClick={() => void sendMessage('viewVideo', { url: card.url, startTime: card.startTime })}
          >
            <ExternalLinkIcon />
            {t('view_video')}
          </Button>
          <CopyButton content={card.primary.text} />
        </div>
      </article>

      <div className='grid shrink-0 grid-cols-2 gap-2'>
        <Button variant='outline' size='sm' disabled={currentIndex === 0 || isSaving} onClick={onPrevious}>
          <ChevronLeftIcon />
          {t('previous')}
        </Button>
        <Button variant='outline' size='sm' disabled={isSaving} onClick={onNext}>
          {t('review_skip')}
          <ChevronRightIcon />
        </Button>
      </div>

      <div className='shrink-0'>
        <p className='mb-2 text-center text-xs text-muted-foreground'>{t('review_judgment_prompt')}</p>
        <div className='grid grid-cols-2 gap-2'>
          <Button
            variant='secondary'
            size='sm'
            disabled={isSaving}
            onClick={() => void handleJudgment(statusActions.continue.reviewStatus)}
          >
            <ContinueIcon />
            {t(statusActions.continue.label)}
          </Button>
          <Button
            size='sm'
            disabled={isSaving}
            onClick={() => void handleJudgment(statusActions.complete.reviewStatus)}
          >
            <CheckIcon />
            {t(statusActions.complete.label)}
          </Button>
        </div>
      </div>
    </section>
  );
}

interface ReviewSessionEndProps {
  hadCards: boolean;
  kind: ReviewSessionKind;
  canReviewCompleted: boolean;
  onOpenLibrary: () => void;
  onReviewCompleted: () => void;
}

function ReviewSessionEnd({
  hadCards,
  kind,
  canReviewCompleted,
  onOpenLibrary,
  onReviewCompleted,
}: ReviewSessionEndProps) {
  const isComplete = hadCards;
  const isPendingSession = kind === 'pending';
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);

  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-3 text-center'>
      <div className='flex flex-col gap-1'>
        <h2 ref={headingRef} tabIndex={-1} className='text-lg font-semibold outline-none'>
          {t(isComplete ? 'review_complete_title' : 'review_queue_empty_title')}
        </h2>
        <p className='text-wrap text-sm leading-relaxed text-muted-foreground'>
          {t(isComplete ? 'review_complete_description' : 'review_queue_empty_description')}
        </p>
      </div>
      <div className='flex w-full max-w-72 flex-col gap-2'>
        <Button onClick={onOpenLibrary}>{t('review_go_to_library')}</Button>
        {isPendingSession && canReviewCompleted && (
          <Button variant='outline' onClick={onReviewCompleted}>
            {t('review_review_completed')}
          </Button>
        )}
      </div>
    </div>
  );
}

interface SubtitleLibraryProps {
  subtitles: SavedSubtitle[];
  onDelete: (id: string) => void;
  onReviewStatusChange: (
    id: string,
    reviewStatus: SavedSubtitleReviewStatus
  ) => Promise<SavedSubtitle | undefined>;
}

function SubtitleLibrary({ subtitles, onDelete, onReviewStatusChange }: SubtitleLibraryProps) {
  const [listedSubtitles, setListedSubtitles] = useState<SavedSubtitle[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all');
  const [headerKey, setHeaderKey] = useState(0);
  const filteredSubtitles = useMemo(
    () => filterSavedSubtitlesByReviewStatus(listedSubtitles, statusFilter),
    [listedSubtitles, statusFilter]
  );

  const clearFilters = () => {
    setStatusFilter('all');
    setHeaderKey((key) => key + 1);
  };

  const handleReviewStatusChange = async (id: string, reviewStatus: SavedSubtitleReviewStatus) => {
    try {
      const updated = await onReviewStatusChange(id, reviewStatus);
      if (!updated) toast.error(t('review_status_update_failed'));
    } catch {
      toast.error(t('review_status_update_failed'));
    }
  };

  return (
    <section className='flex min-h-0 flex-1 flex-col' aria-label={t('review_mode_library')}>
      <ListHeader
        key={headerKey}
        originalList={subtitles}
        onFilteredListChange={setListedSubtitles}
        getFilterText={getSavedSubtitleSearchText}
      />
      <ReviewStatusFilters value={statusFilter} onChange={setStatusFilter} />
      {filteredSubtitles.length === 0 ? (
        <FilteredEmptyState onClear={clearFilters} />
      ) : (
        <ul className='flex min-h-0 flex-1 flex-col overflow-auto pr-1 pb-1'>
          {filteredSubtitles.map((item) => (
            <SubtitleItem
              key={item.id}
              {...item}
              onDelete={onDelete}
              onReviewStatusChange={(id, reviewStatus) => {
                void handleReviewStatusChange(id, reviewStatus);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface ReviewStatusFiltersProps {
  value: ReviewStatusFilter;
  onChange: (value: ReviewStatusFilter) => void;
}

function ReviewStatusFilters({ value, onChange }: ReviewStatusFiltersProps) {
  return (
    <div className='border-b py-2'>
      <ToggleGroup
        type='single'
        value={value}
        variant='outline'
        size='sm'
        className='w-full'
        aria-label={t('review_status_filter')}
        onValueChange={(nextValue) => {
          if (isReviewStatusFilter(nextValue)) onChange(nextValue);
        }}
      >
        {REVIEW_STATUS_FILTERS.map((filter) => (
          <ToggleGroupItem key={filter} value={filter} aria-label={t(REVIEW_STATUS_LABELS[filter])}>
            {t(REVIEW_STATUS_LABELS[filter])}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

function LoadingState() {
  return (
    <div className='flex h-full items-center justify-center p-4 text-sm text-muted-foreground' aria-live='polite'>
      {t('review_loading')}
    </div>
  );
}

function EmptyState() {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-1 p-4 text-center'>
      <h2 className='text-base font-semibold'>{t('review_empty_title')}</h2>
      <p className='text-wrap text-sm leading-relaxed text-muted-foreground'>{t('review_description')}</p>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center'>
      <p className='text-wrap text-sm text-muted-foreground'>{t('review_status_empty')}</p>
      <Button variant='outline' size='sm' onClick={onClear}>
        {t('clear_filters')}
      </Button>
    </div>
  );
}

interface SubtitleItemProps extends SavedSubtitle {
  onDelete: (id: string) => void;
  onReviewStatusChange: (id: string, reviewStatus: SavedSubtitleReviewStatus) => void;
}

function SubtitleItem({
  id,
  primary,
  secondary,
  reviewStatus,
  url,
  startTime,
  onDelete,
  onReviewStatusChange,
}: SubtitleItemProps) {
  return (
    <li className='flex min-w-0 flex-col gap-2 border-b py-3'>
      <div className='flex min-w-0 select-text flex-col gap-1'>
        <p className='text-wrap text-[15px] font-medium leading-relaxed'>{primary.text}</p>
        {secondary && (
          <p className='text-wrap text-[13px] leading-relaxed text-muted-foreground'>{secondary.text}</p>
        )}
      </div>
      <div className='flex min-w-0 items-center justify-between gap-2'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='outline'
              className='h-7 min-w-0 gap-1 rounded px-2 text-xs'
              aria-label={t('review_status_change', t(REVIEW_STATUS_LABELS[reviewStatus]))}
            >
              {t(REVIEW_STATUS_LABELS[reviewStatus])}
              <ChevronDownIcon className='size-3' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='start'>
            <DropdownMenuRadioGroup
              value={reviewStatus}
              onValueChange={(value) => {
                if (isSavedSubtitleReviewStatus(value)) onReviewStatusChange(id, value);
              }}
            >
              {REVIEW_STATUS_FILTERS.filter((filter) => filter !== 'all').map((status) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {t(REVIEW_STATUS_LABELS[status])}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className='flex shrink-0 items-center'>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('view_video')}
            aria-label={t('view_video')}
            onClick={() => void sendMessage('viewVideo', { url, startTime })}
          >
            <ExternalLinkIcon />
          </Button>
          <CopyButton content={primary.text} />
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('delete')}
            aria-label={t('delete')}
            onClick={() => onDelete(id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>
    </li>
  );
}

function createReviewSession(subtitles: SavedSubtitle[], kind: ReviewSessionKind): ReviewSession {
  return {
    cards: subtitles.filter(({ reviewStatus }) =>
      kind === 'mastered' ? reviewStatus === 'mastered' : reviewStatus === 'new' || reviewStatus === 'learning'
    ),
    currentIndex: 0,
    kind,
    statusOverrides: {},
  };
}

function isReviewMode(value: string): value is ReviewMode {
  return REVIEW_MODES.some((mode) => mode === value);
}
