import { LearningCard } from '@storage/v2/type';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';

interface LearningCardContentProps {
  card: LearningCard;
  showSupport?: boolean;
}

export function LearningCardContent({ card, showSupport = true }: LearningCardContentProps) {
  if ('unassigned' in card.content) {
    return (
      <div className='flex min-w-0 flex-col gap-1'>
        <div className='flex flex-wrap items-center gap-1 text-xs text-muted-foreground'>
          <span className='rounded-full bg-muted px-2 py-0.5 font-medium text-foreground'>
            {t('v2_library_unassigned')}
          </span>
          <span>{t('v2_library_language_unassigned')}</span>
        </div>
        <p className='select-text whitespace-pre-wrap break-words text-[15px] font-medium leading-relaxed [overflow-wrap:anywhere]'>
          {card.content.unassigned.text}
        </p>
      </div>
    );
  }

  return (
    <div className='flex min-w-0 flex-col gap-3'>
      <CardLine
        label={t('v2_library_learning')}
        language={t(LANGUAGES[card.content.learning.language])}
        text={card.content.learning.text}
        emphasized
      />
      {showSupport && card.content.support && (
        <CardLine
          label={t('v2_library_support')}
          language={t(LANGUAGES[card.content.support.language])}
          text={card.content.support.text}
        />
      )}
    </div>
  );
}

interface CardLineProps {
  emphasized?: boolean;
  label: string;
  language: string;
  text: string;
}

function CardLine({ emphasized = false, label, language, text }: CardLineProps) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <div className='flex flex-wrap items-center gap-1 text-xs text-muted-foreground'>
        <span className='rounded-full bg-muted px-2 py-0.5 font-medium text-foreground'>{label}</span>
        <span>{language}</span>
      </div>
      <p
        className={`select-text whitespace-pre-wrap break-words leading-relaxed [overflow-wrap:anywhere] ${
          emphasized ? 'text-[15px] font-medium' : 'text-[13px] text-muted-foreground'
        }`}
      >
        {text}
      </p>
    </div>
  );
}
