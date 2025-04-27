import DOMPurify from 'dompurify';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { findSubtitleIndex } from '@utils/helper';
import { t } from '@utils/i18n';
import { onMessage } from '@utils/message';
import { SubtitleData } from '@utils/parse';

import { Button } from '@/ui/components/button';
import { useTabInfo } from '@/ui/hooks/use-tab-info';
import { cn } from '@/ui/lib/utils';

const SUBTITLE_OPTIONS = [
  { id: 'en', label: t('english') },
  { id: 'ko', label: t('korean') },
] as const;

export function SubtitleAnalysisPage() {
  const [subtitles, setSubtitles] = useState<SubtitleData[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [language, setLanguage] = useState<'en' | 'ko'>('en');
  const { tabInfo } = useTabInfo();
  const activeSubtitleRef = useRef<HTMLLIElement>(null);

  const activeIndex = useMemo(() => findSubtitleIndex(subtitles, currentTime), [subtitles, currentTime]);

  useEffect(() => {
    if (tabInfo?.[language]) {
      setSubtitles(tabInfo[language]);
    } else {
      setSubtitles([]);
    }
  }, [tabInfo, language]);

  useEffect(() => {
    const { remove } = onMessage((message) => {
      if (message.updateCurrentTime) {
        setCurrentTime(message.updateCurrentTime);
      }
    });
    return remove;
  }, []);

  useEffect(() => {
    activeSubtitleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeIndex]);

  return (
    <div className='h-full flex flex-col'>
      <header className='flex items-center border-b py-1 px-2'>
        {SUBTITLE_OPTIONS.map((subtitle) => (
          <Button
            variant='ghost'
            size='sm'
            key={subtitle.id}
            onClick={() => setLanguage(subtitle.id)}
            className={cn(language === subtitle.id && 'bg-accent text-accent-foreground')}
          >
            {subtitle.label}
          </Button>
        ))}
      </header>
      <div className='p-2 overflow-y-auto'>
        <ul className='flex flex-col gap-1'>
          {subtitles.map((subtitle, index) => (
            <SubtitleItem
              key={index}
              text={subtitle.text}
              isActive={index === activeIndex}
              ref={index === activeIndex ? activeSubtitleRef : null}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

const SubtitleItem = memo(
  ({ text, isActive, ...props }: { text: string; isActive: boolean } & React.ComponentProps<'li'>) => (
    <li className={cn('p-2 rounded', isActive ? 'bg-primary/20' : 'bg-gray-50')} {...props}>
      <p
        className='whitespace-pre-line'
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(text),
        }}
      />
    </li>
  )
);
SubtitleItem.displayName = 'SubtitleItem';
