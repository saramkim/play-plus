import { ArrowUpTrayIcon } from '@heroicons/react/20/solid';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { getLocalStorage, setLocalStorage } from '@storage/index';
import { setLocalSubtitle } from '@storage/subtitle';
import { Language, LANGUAGES, REGISTRATION } from '@utils/constants';
import { t } from '@utils/i18n';
import { getSubtitleFormat, parseSubtitle } from '@utils/parse';
import { useRef, useState } from 'react';
import { usePopup } from '../../contexts/PopupContext';
import DropdownButton from '../elements/DropdownButton';
import MessagePopup from '../elements/MessagePopup';

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([key, value]) => ({
  value: key,
  label: t(value),
}));
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const DEFAULT_LANGUAGE: Language = 'en';

const allowedExtensions = ['.vtt', '.srt', '.smi'];

const validateFile = (file: File) => {
  const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, message: t('error_unsupported_file_type') };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, message: t('error_file_size') };
  }
  return { isValid: true, message: '' };
};

const uploadSubtitle = (file: File, title: string, language: Language) => {
  return new Promise<void>((resolve) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = async () => {
      const content = reader.result as string;
      const id = `${REGISTRATION.ID_PREFIX}-${crypto.randomUUID()}` as const;
      const subtitle = getSubtitle(file, content);
      const newData = { id, title, language, savedAt: new Date().toISOString() };
      await Promise.all([
        setLocalSubtitle(id, subtitle),
        setLocalStorage('registeredSubtitles', [...((await getLocalStorage('registeredSubtitles')) ?? []), newData]),
      ]);
      resolve();
    };
  });
};

const getSubtitle = (file: File, content: string) => {
  const fileExtension = getSubtitleFormat(file);
  if (!fileExtension) return [];
  return parseSubtitle[fileExtension](content);
};

const SubtitleUploader = () => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { showPopup, hidePopup } = usePopup();

  const handleFileUpload = (file: File) => {
    const { isValid, message } = validateFile(file);
    if (isValid) {
      setFile(file);
      setTitle(file.name.replace(/\.[^.]+$/, ''));
    } else {
      showPopup({
        title: t('error'),
        content: <MessagePopup message={message} type='alert' hidePopup={hidePopup} />,
        status: 'error',
      });
    }
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setLanguage(DEFAULT_LANGUAGE);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className='flex flex-col gap-2'>
      <div
        className='flex justify-center items-center gap-2 border rounded-md p-4 hover:bg-gray-100 cursor-pointer'
        onClick={() => fileInputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        {file ? (
          <>
            <DocumentTextIcon className='size-5 flex-shrink-0' />
            <span className='text-[15px] font-bold truncate'>{file.name}</span>
          </>
        ) : (
          <>
            <ArrowUpTrayIcon className='size-5' />
            <span className='text-[15px] font-bold'>{t('upload_subtitle_file')}</span>
            <span className='text-[12px] text-gray-500'>
              {allowedExtensions.map((ext) => ext.replace('.', '').toUpperCase()).join(', ')}
            </span>
          </>
        )}

        <input
          ref={fileInputRef}
          type='file'
          accept={allowedExtensions.join(',')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
          }}
          className='hidden'
        />
      </div>

      {file && (
        <div className={`flex flex-col gap-2 border rounded-md p-4 ${isUploading ? 'opacity-50' : ''}`}>
          <div className='flex justify-between items-center gap-1'>
            <DropdownButton options={LANGUAGE_OPTIONS} value={language} onChange={setLanguage} />
            <input
              type='text'
              className='input'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
            />
          </div>
          <div className='flex gap-2'>
            <button
              className='w-full bg-gray-500 text-white rounded-full p-2 font-medium'
              onClick={reset}
              disabled={isUploading}
            >
              {t('cancel')}
            </button>
            <button
              className='w-full bg-teal-500 text-white rounded-full p-2 font-medium'
              onClick={async () => {
                setIsUploading(true);
                await uploadSubtitle(file, title, language);
                setIsUploading(false);
                reset();
              }}
              disabled={isUploading}
            >
              {t('register')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleUploader;
