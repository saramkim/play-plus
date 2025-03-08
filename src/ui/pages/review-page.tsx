import { useState } from 'react';

import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon, PlayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { setLocalStorage } from '@storage/index';
import { SavedSubtitle } from '@storage/type';
import { COUPANG_PLAY_PLAY_URL, REVIEW } from '@utils/constants';
import { t } from '@utils/i18n';
import { sendMessage } from '@utils/message';
import { toast } from 'sonner';

import { ListHeader } from '@/ui/components/layout/list-header';
import { useSubtitles } from '@/ui/hooks/use-subtitles';

const { STORAGE_KEY } = REVIEW;

export function ReviewPage() {
  const [filteredSubtitles, setFilteredSubtitles] = useState<SavedSubtitle[]>([]);
  const { subtitles } = useSubtitles('savedSubtitles');

  const deleteSubtitle = (content: string) => {
    const filtered = subtitles.filter((v) => v.content !== content);
    setLocalStorage(STORAGE_KEY, filtered);

    toast(t('delete'), {
      description: content,
      action: {
        label: t('undo'),
        onClick: () => {
          toast.dismiss();
          const deletedItem = subtitles.find((v) => v.content === content);
          if (deletedItem) {
            setLocalStorage(STORAGE_KEY, [...filtered, deletedItem]);
          }
        },
      },
    });
  };

  return (
    <div className='flex flex-col h-full px-4 pt-4'>
      <ListHeader originalList={subtitles} onFilteredListChange={setFilteredSubtitles} filterKey='content' />
      {subtitles.length > 0 ? (
        <ul className='flex flex-col h-full overflow-auto pr-1 pb-1'>
          {filteredSubtitles.map((item) => SubtitleItem({ ...item, onDelete: deleteSubtitle }))}
        </ul>
      ) : (
        <div className='flex flex-col justify-center items-center h-full gap-2'>
          <p className='text-gray-500'>{t('no_saved_subtitles')}</p>
          <p className='text-gray-500'>{t('no_saved_subtitles_description')}</p>
        </div>
      )}
    </div>
  );
}

interface SubtitleItemProps extends SavedSubtitle {
  onDelete: (content: string) => void;
}

function SubtitleItem({ content, savedAt, url, startTime, onDelete }: SubtitleItemProps) {
  const viewVideo = () => {
    sendMessage('viewVideo', { url, startTime });
  };

  return (
    <li key={content} className='flex flex-col gap-[6px] py-2 border-b'>
      <div className='flex items-center'>
        <p className='text-[15px] font-medium text-wrap select-text w-full'>{content}</p>
      </div>
      <div className='flex justify-between items-center text-[13px]'>
        <div className='flex items-center gap-1'>
          <button className='icon-button' disabled={!url.startsWith(COUPANG_PLAY_PLAY_URL)} onClick={viewVideo}>
            <PlayIcon
              title={url.startsWith(COUPANG_PLAY_PLAY_URL) ? t('view_video') : t('error_unsupported_url')}
              className='size-5'
            />
          </button>
          <CopyButton content={content} />
          <button className='icon-button' onClick={() => onDelete(content)}>
            <TrashIcon title={t('delete')} className='size-5' />
          </button>
        </div>
        <p className='text-gray-800'>{new Date(savedAt).toLocaleString()}</p>
      </div>
    </li>
  );
}

const COPY_FEEDBACK_DURATION = 1800;

function CopyButton({ content }: { content: string }) {
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
