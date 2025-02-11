import { XMarkIcon } from '@heroicons/react/16/solid';
import { useRef } from 'react';
import { t } from '@utils/i18n';

interface ListHeaderProps {
  searchText: string;
  setSearchText: (text: string) => void;
  count: number;
  sort: 'latest' | 'oldest';
  setSort: (sort: 'latest' | 'oldest') => void;
}

function ListHeader({ searchText, setSearchText, count, sort, setSort }: ListHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

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
          <input className='input' ref={searchInputRef} />
          <button className='button bg-teal-500' type='submit'>
            {t('search')}
          </button>
        </form>
      </div>
      <div className='flex justify-between items-center gap-2 h-5'>
        {searchText ? (
          <div className='flex items-center gap-1 w-full overflow-hidden'>
            <button className='text-rose-500' onClick={clearSearch}>
              <XMarkIcon className='size-4' />
            </button>
            <span className='text-gray-800'>{t('search_term')}:</span>
            <span className='font-bold truncate'>{searchText}</span>
          </div>
        ) : (
          <div className='text-gray-800'>
            <span className='font-medium'>{t('all_list')}</span>
            <span>({count})</span>
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

export default ListHeader;
