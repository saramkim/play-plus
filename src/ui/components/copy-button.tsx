import { useState } from 'react';

import { t } from '@utils/i18n';
import { CopyCheckIcon, CopyIcon } from 'lucide-react';

import { Button } from './button';

const COPY_FEEDBACK_DURATION = 1800;

export function CopyButton({ content }: { content: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return isCopied ? (
    <div className='flex items-center gap-1 text-gray-700 h-6 px-0.75'>
      <CopyCheckIcon className='size-4.5' />
      <span>{t('copied')}</span>
    </div>
  ) : (
    <Button
      variant='ghost'
      size='xxs'
      tooltip={t('copy')}
      onClick={async () => {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, COPY_FEEDBACK_DURATION);
      }}
    >
      <CopyIcon />
    </Button>
  );
}
