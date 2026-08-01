import { useMemo, useState } from 'react';

import { getSavedSubtitleSearchText } from '@storage/saved-subtitle';
import { SavedSubtitle, SavedSubtitleReviewStatus } from '@storage/type';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message/index';
import { ChevronDownIcon, PlayIcon, Trash2Icon } from 'lucide-react';

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

export function ReviewPage() {
  const [listedSubtitles, setListedSubtitles] = useState<SavedSubtitle[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('all');
  const { subtitles, deleteSubtitle, updateReviewStatus, loading } = useSavedSubtitle();
  const filteredSubtitles = useMemo(
    () => filterSavedSubtitlesByReviewStatus(listedSubtitles, statusFilter),
    [listedSubtitles, statusFilter]
  );

  if (loading) return null;
  if (subtitles.length === 0) return <EmptyState />;

  return (
    <div className='flex flex-col h-full px-4 pt-4'>
      <ListHeader
        originalList={subtitles}
        onFilteredListChange={setListedSubtitles}
        getFilterText={getSavedSubtitleSearchText}
      />
      <ReviewStatusFilters value={statusFilter} onChange={setStatusFilter} />
      {filteredSubtitles.length === 0 ? (
        <FilteredEmptyState />
      ) : (
        <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
          {filteredSubtitles.map((item) => (
            <SubtitleItem
              key={item.id}
              {...item}
              onDelete={deleteSubtitle}
              onReviewStatusChange={(id, reviewStatus) => {
                void updateReviewStatus(id, reviewStatus);
              }}
            />
          ))}
        </ul>
      )}
    </div>
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

function EmptyState() {
  return (
    <div className='h-full flex flex-col justify-center p-4'>
      <p className='text-center text-gray-500'>{t('review_description')}</p>
    </div>
  );
}

function FilteredEmptyState() {
  return (
    <div className='flex h-full flex-col justify-center p-4'>
      <p className='text-center text-gray-500'>{t('review_status_empty')}</p>
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
  savedAt,
  url,
  startTime,
  onDelete,
  onReviewStatusChange,
}: SubtitleItemProps) {
  return (
    <li className='flex min-w-0 flex-col gap-[6px] border-b py-2'>
      <div className='flex min-w-0 select-text flex-col gap-1'>
        <p className='text-wrap text-[15px] font-medium'>{primary.text}</p>
        {secondary && <p className='text-wrap text-[13px] text-muted-foreground'>{secondary.text}</p>}
      </div>
      <div className='flex items-center justify-between gap-2 text-[13px]'>
        <div className='flex shrink-0 items-center'>
          <Button
            variant='ghost'
            size='xxs'
            tooltip={t('view_video')}
            onClick={() => sendMessage('viewVideo', { url, startTime })}
          >
            <PlayIcon />
          </Button>
          <CopyButton content={primary.text} />
          <Button variant='ghost' size='xxs' tooltip={t('delete')} onClick={() => onDelete(id)}>
            <Trash2Icon />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                className='h-6 min-w-0 gap-1 rounded px-2 text-[12px]'
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
        </div>
        <p className='min-w-0 truncate text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}
