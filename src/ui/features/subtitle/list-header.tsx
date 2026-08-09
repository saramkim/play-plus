
import { useEffect, useRef, useState } from 'react';

import { t } from '@utils/i18n';
import { XIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';

interface ListHeaderProps<T extends { savedAt: string }> {
  originalList: T[];
  onFilteredListChange: (filteredList: T[]) => void;
  searchQuery: string;
  onSearchQueryChange: (searchQuery: string) => void;
  disabled?: boolean;
  filterKey?: keyof T extends string ? keyof T : never;
  getFilterText?: (item: T) => string;
}

export function ListHeader<T extends { savedAt: string }>({
  originalList,
  onFilteredListChange,
  searchQuery,
  onSearchQueryChange,
  disabled = false,
  filterKey,
  getFilterText,
}: ListHeaderProps<T>) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previousSearchQueryRef = useRef(searchQuery);
  const [searchDraft, setSearchDraft] = useState(searchQuery);
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');

  useEffect(() => {
    const filtered = searchQuery
      ? originalList.filter((item) => {
          const value = getFilterText ? getFilterText(item) : String(item[filterKey!]);
          return value.toLowerCase().includes(searchQuery.toLowerCase());
        })
      : originalList;

    onFilteredListChange(
      [...filtered].sort((a, b) => {
        const timeA = new Date(a.savedAt).getTime();
        const timeB = new Date(b.savedAt).getTime();
        return sort === 'latest' ? timeB - timeA : timeA - timeB;
      })
    );
  }, [filterKey, getFilterText, onFilteredListChange, originalList, searchQuery, sort]);

  useEffect(() => {
    const previousSearchQuery = previousSearchQueryRef.current;
    previousSearchQueryRef.current = searchQuery;
    if (previousSearchQuery === searchQuery) return;

    setSearchDraft(searchQuery);
    if (!searchQuery) searchInputRef.current?.focus();
  }, [searchQuery]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    const nextSearchQuery = searchDraft.trim();
    setSearchDraft(nextSearchQuery);
    onSearchQueryChange(nextSearchQuery);
  };

  const clearSearch = () => {
    if (disabled) return;
    setSearchDraft('');
    onSearchQueryChange('');
    searchInputRef.current?.focus();
  };

  return (
    <header className='flex flex-col gap-1.5 border-b pb-1.5'>
      <div className='flex justify-between items-center gap-2'>
        <form className='flex items-center gap-2 w-full' onSubmit={search}>
          <Input
            ref={searchInputRef}
            aria-label={t('search')}
            value={searchDraft}
            disabled={disabled}
            onChange={(event) => setSearchDraft(event.currentTarget.value)}
          />
          <Button size='sm' type='submit' disabled={disabled}>
            {t('search')}
          </Button>
        </form>
      </div>
      <div className='flex justify-between items-center gap-2 h-5'>
        {searchQuery ? (
          <div className='flex items-center gap-1 w-full overflow-hidden'>
            <button
              type='button'
              aria-label={t('clear_search')}
              disabled={disabled}
              className='disabled:cursor-not-allowed disabled:opacity-50'
              onClick={clearSearch}
            >
              <XIcon className='size-4 text-destructive hover:text-destructive/80' />
            </button>
            <span className='text-gray-800'>{t('search_term')}:</span>
            <span className='font-bold truncate'>{searchQuery}</span>
          </div>
        ) : (
          <div className='text-gray-800'>
            <span className='font-medium'>{t('all_list')}</span>
            <span>({originalList.length})</span>
          </div>
        )}

        <div className='flex items-center gap-1'>
          <button
            type='button'
            aria-pressed={sort === 'latest'}
            disabled={disabled}
            className={`${sort === 'latest' ? 'font-bold' : 'text-gray-500'} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => setSort('latest')}
          >
            {t('latest')}
          </button>
          <span className='text-gray-300'>|</span>
          <button
            type='button'
            aria-pressed={sort === 'oldest'}
            disabled={disabled}
            className={`${sort === 'oldest' ? 'font-bold' : 'text-gray-500'} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => setSort('oldest')}
          >
            {t('oldest')}
          </button>
        </div>
      </div>
    </header>
  );
}
