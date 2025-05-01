import DOMPurify from 'dompurify';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { getLocalStorage, setLocalStorage } from '@storage/index';
import { getLocalSubtitle, SubtitleId } from '@storage/subtitle';
import { LANGUAGES } from '@utils/constants';
import { findSubtitleIndex, formatTime, stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { onMessage, sendMessageToTab } from '@utils/message';
import { SubtitleData } from '@utils/parse';
import { MouseIcon, StarIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { Toggle } from '@/ui/components/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/components/tooltip';
import { useRegisteredSubtitles } from '@/ui/features/subtitle/use-registered-subtitles';
import { useTabInfo } from '@/ui/hooks/use-tab-info';
import { cn } from '@/ui/lib/utils';

type DefaultSubtitleId = 'en' | 'ko';

export function SubtitleAnalysisPage() {
  const [subtitles, setSubtitles] = useState<SubtitleData[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [subtitleId, setSubtitleId] = useState<DefaultSubtitleId | SubtitleId>('en');
  const [autoScroll, setAutoScroll] = useState(true);
  const { activeTab, tabInfo } = useTabInfo();
  const activeSubtitleRef = useRef<HTMLLIElement>(null);

  const activeIndex = useMemo(() => findSubtitleIndex(subtitles, currentTime), [subtitles, currentTime]);
  const defaultSubtitleOptions = useMemo(() => {
    return tabInfo
      ? Object.keys(tabInfo)
          .filter((key) => key === 'en' || key === 'ko')
          .map((key) => ({ id: key, label: t(LANGUAGES[key]) }))
      : [];
  }, [tabInfo]);
  const isDefaultSubtitle = subtitleId === 'en' || subtitleId === 'ko';

  useEffect(() => {
    (async () => {
      const subtitle = isDefaultSubtitle ? tabInfo?.[subtitleId] || [] : await getLocalSubtitle(subtitleId);
      setSubtitles(subtitle);
    })();
  }, [subtitleId, tabInfo]);

  useEffect(() => {
    const { remove } = onMessage((message) => {
      if (message.updateCurrentTime) {
        setCurrentTime(message.updateCurrentTime);
      }
    });
    return remove;
  }, []);

  useEffect(() => {
    if (autoScroll) {
      activeSubtitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex, autoScroll]);

  return (
    <div className='h-full flex flex-col'>
      <header className='flex items-center justify-between border-b p-2'>
        <div className='flex items-center gap-1 overflow-x-auto'>
          <RegisteredSubtitleSelect selectedId={isDefaultSubtitle ? null : subtitleId} onSelect={setSubtitleId} />
          {defaultSubtitleOptions.map(({ id, label }) => (
            <Button
              variant='outline'
              size='sm'
              key={id}
              onClick={() => setSubtitleId(id)}
              className={cn(id === subtitleId ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className='border-l pl-2'>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Toggle pressed={autoScroll} onPressedChange={setAutoScroll} aria-label={t('auto_scroll')} size='sm'>
                  <MouseIcon className='size-5' />
                </Toggle>
              </div>
            </TooltipTrigger>
            <TooltipContent>{t('auto_scroll')}</TooltipContent>
          </Tooltip>
        </div>
      </header>

      {subtitles.length === 0 ? (
        <div className='p-4 h-full flex items-center justify-center text-center'>
          <p className='whitespace-pre-line text-wrap'>{t('subtitle_analysis_description')}</p>
        </div>
      ) : (
        <div className='p-2 overflow-y-auto'>
          <ul className='flex flex-col gap-1'>
            {subtitles.map((subtitle, index) => (
              <SubtitleItem
                key={index}
                ref={index === activeIndex ? activeSubtitleRef : null}
                subtitle={subtitle}
                isActive={index === activeIndex}
                onClick={() => {
                  if (activeTab?.id) {
                    sendMessageToTab(activeTab.id, 'playVideo', { startTime: subtitle.start });
                  } else {
                    toast.error(t('error_video_not_found'));
                  }
                }}
                onSave={async (subtitle) => {
                  const content = stripTags(subtitle.text);
                  const prevData = (await getLocalStorage('savedSubtitles')) || [];
                  const isDuplicated = prevData.some(({ content: prevContent }) => prevContent === content);

                  if (isDuplicated) {
                    toast.error(t('error_duplicate_subtitle'));
                  } else {
                    const data = {
                      content,
                      url: activeTab?.url || '',
                      startTime: subtitle.start,
                      savedAt: new Date().toISOString(),
                    };
                    await setLocalStorage('savedSubtitles', [...prevData, data]);
                    toast.success(t('success_save_subtitle'));
                  }
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface RegisteredSubtitleSelectProps {
  selectedId: SubtitleId | null;
  onSelect: (subtitleId: SubtitleId) => void;
}

const RegisteredSubtitleSelect = ({ selectedId, onSelect }: RegisteredSubtitleSelectProps) => {
  const { subtitles } = useRegisteredSubtitles();
  return (
    <Select value={selectedId || ''} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder={t('registered_subtitle')} />
      </SelectTrigger>
      <SelectContent>
        {subtitles.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {`${option.title} (${t(LANGUAGES[option.language])})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

interface SubtitleItemProps extends React.ComponentProps<'li'> {
  subtitle: SubtitleData;
  isActive: boolean;
  onSave: (subtitle: SubtitleData) => void;
}

const SubtitleItem = memo(({ subtitle, isActive, onSave, ...props }: SubtitleItemProps) => {
  const { text, start, end } = subtitle;
  return (
    <li
      className={cn('p-2 rounded relative group', isActive ? 'bg-primary/20' : 'bg-gray-50 hover:bg-gray-200')}
      {...props}
    >
      <p
        className='whitespace-pre-line'
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(text),
        }}
      />
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
    </li>
  );
});
SubtitleItem.displayName = 'SubtitleItem';
