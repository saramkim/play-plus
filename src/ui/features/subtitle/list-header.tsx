import { useEffect, useRef, useState } from 'react';

import { XMarkIcon } from '@heroicons/react/16/solid';
import { SavedSubtitle, SubtitleMetadata } from '@storage/schema';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';

interface ListHeaderProps<T extends SubtitleMetadata | SavedSubtitle> {
  originalList: T[];
  onFilteredListChange: (filteredList: T[]) => void;
  filterKey: keyof T extends string ? keyof T : never;
}

export function ListHeader<T extends SubtitleMetadata | SavedSubtitle>({
  originalList,
  onFilteredListChange,
  filterKey,
}: ListHeaderProps<T>) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest');

  useEffect(() => {
    const filtered = searchText
      ? originalList.filter((item) => String(item[filterKey]).toLowerCase().includes(searchText.toLowerCase()))
      : originalList;

    onFilteredListChange(
      [...filtered].sort((a, b) => {
        const timeA = new Date(a.savedAt).getTime();
        const timeB = new Date(b.savedAt).getTime();
        return sort === 'latest' ? timeB - timeA : timeA - timeB;
      })
    );
  }, [originalList, searchText, sort]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const text = searchInputRef.current?.value.trim() || '';
    setSearchText(text);
  };

  const clearSearch = () => {
    setSearchText('');
  };

  return (
    <header className='flex flex-col gap-2 pb-2 border-b'>
      <div className='flex justify-between items-center gap-2'>
        <form className='flex items-center gap-2 w-full' onSubmit={search}>
          <Input ref={searchInputRef} />
          <Button size='sm' type='submit'>
            {t('search')}
          </Button>
        </form>
      </div>
      <div className='flex justify-between items-center gap-2 h-5'>
        {searchText ? (
          <div className='flex items-center gap-1 w-full overflow-hidden'>
            <button className='text-destructive' onClick={clearSearch}>
              <XMarkIcon className='size-4' />
            </button>
            <span className='text-gray-800'>{t('search_term')}:</span>
            <span className='font-bold truncate'>{searchText}</span>
          </div>
        ) : (
          <div className='text-gray-800'>
            <span className='font-medium'>{t('all_list')}</span>
            <span>({originalList.length})</span>
          </div>
        )}

        <div className='flex items-center gap-1'>
          <button className={sort === 'latest' ? 'font-bold' : 'text-gray-500'} onClick={() => setSort('latest')}>
            {t('latest')}
          </button>
          <span className='text-gray-300'>|</span>
          <button className={sort === 'oldest' ? 'font-bold' : 'text-gray-500'} onClick={() => setSort('oldest')}>
            {t('oldest')}
          </button>
        </div>
      </div>
    </header>
  );
}
