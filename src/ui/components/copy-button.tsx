import { useState } from 'react';

import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline';
import { t } from '@utils/i18n';

const COPY_FEEDBACK_DURATION = 1800;

export function CopyButton({ content }: { content: string }) {
  const [isCopied, setIsCopied] = useState(false);

  return isCopied ? (
    <div className='flex items-center gap-1 text-gray-700'>
      <ClipboardDocumentCheckIcon title={t('copied')} className='size-5' />
      <span>{t('copied')}</span>
    </div>
  ) : (
    <button
      className='icon-button'
      onClick={async () => {
        await navigator.clipboard.writeText(content);
        setIsCopied(true);
        setTimeout(() => {
          setIsCopied(false);
        }, COPY_FEEDBACK_DURATION);
      }}
    >
      <ClipboardDocumentIcon title={t('copy')} className='size-5' />
    </button>
  );
}
