
import { memo } from 'react';

import { formatTime, cn } from '@utils/helper';
import { t } from '@utils/i18n';
import { SubtitleData } from '@utils/parse';
import { StarIcon, StarOffIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';

interface SubtitleItemProps extends React.ComponentProps<'div'> {
  subtitle: SubtitleData;
  isActive: boolean;
  isSaved: boolean;
  onToggleSave: (subtitle: SubtitleData) => void;
  playButtonRef?: React.Ref<HTMLButtonElement>;
  companionCues?: SubtitleData[];
}

export const SubtitleItem = memo(
  ({ subtitle, isActive, isSaved, onToggleSave, playButtonRef, companionCues, className, ...props }: SubtitleItemProps) => {
    const { text, start, end } = subtitle;
    return (
      <div
        className={cn(
          'p-2 rounded flex items-center gap-2',
          isActive ? 'bg-primary/20' : isSaved ? 'bg-yellow-50 hover:bg-yellow-100' : 'bg-gray-50 hover:bg-gray-100',
          className
        )}
        {...props}
      >
        <div className='min-w-0 flex-1'>
        <button type='button' ref={playButtonRef} data-subtitle-play aria-current={isActive ? 'true' : undefined}
          className='w-full min-w-0 rounded text-left focus-visible:outline-2 focus-visible:outline-primary'>
          <span className='block whitespace-pre-line break-words'>{text}</span>
          <span className='block text-xs text-muted-foreground'>{formatTime(start)} - {formatTime(end)}</span>
        </button>
        {!!companionCues?.length && <div data-companion-text className='mt-1 border-l-2 pl-2 text-sm text-muted-foreground'>
          {companionCues.map((cue, index) => <p key={index} className='whitespace-pre-line break-words'>{cue.text}</p>)}
        </div>}
        </div>
        <Button
          type='button'
          aria-label={`${t(isSaved ? 'delete' : 'save')}: ${text}`}
          variant='ghost'
          size='xxs'
          className={cn(
            'shrink-0',
            isSaved ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 hover:text-yellow-800' : 'bg-gray-100'
          )}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleSave(subtitle);
          }}
        >
          {isSaved ? <StarOffIcon className='size-4' /> : <StarIcon className='size-4' />}
        </Button>
      </div>
    );
  }
);
SubtitleItem.displayName = 'SubtitleItem';
