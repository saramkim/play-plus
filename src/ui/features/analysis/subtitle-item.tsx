import { memo } from 'react';

import { formatTime, cn } from '@utils/helper';
import { SubtitleData } from '@utils/parse';
import { StarIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';

interface SubtitleItemProps extends React.ComponentProps<'div'> {
  subtitle: SubtitleData;
  isActive: boolean;
  onSave: (subtitle: SubtitleData) => void;
}

export const SubtitleItem = memo(({ subtitle, isActive, onSave, className, ...props }: SubtitleItemProps) => {
  const { text, start, end } = subtitle;
  return (
    <div
      className={cn(
        'p-2 rounded relative group',
        isActive ? 'bg-primary/20' : 'bg-gray-50 hover:bg-gray-200',
        className
      )}
      {...props}
    >
      <p className='whitespace-pre-line'>{text}</p>
      <div
        className={cn(
          'absolute bottom-[calc(100%+0.25rem)] right-0 bg-gray-200 rounded px-2 py-1 z-10 text-[13px]',
          'opacity-0 group-hover:opacity-100 pointer-events-none'
        )}
      >
        {formatTime(start)} - {formatTime(end)}
      </div>
      <Button
        variant='ghost'
        size='xxs'
        className='absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 bg-gray-200'
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onSave(subtitle);
        }}
      >
        <StarIcon className='size-4' />
      </Button>
    </div>
  );
});
SubtitleItem.displayName = 'SubtitleItem';
