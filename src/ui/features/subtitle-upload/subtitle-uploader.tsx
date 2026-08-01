
import { useRef, useState } from 'react';

import { addRegisteredSubtitle } from '@storage/registered-subtitle';
import { ENCODING_MAP, Language, LANGUAGE_ENCODING_MAP, LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';
import { getSubtitleFormat, parseSubtitle } from '@utils/parse';
import { FileTextIcon, FileUpIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { modal } from '@/ui/components/modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([key, value]) => ({
  value: key,
  label: t(value),
}));
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const DEFAULT_LANGUAGE: Language = 'en';

const allowedExtensions = ['.vtt', '.srt', '.smi'];
const allowedExtensionsString = allowedExtensions.map((ext) => ext.replace('.', '').toUpperCase()).join(', ');

const validateFile = (file: File) => {
  const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, message: t('error_unsupported_file_type', allowedExtensionsString) };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, message: t('error_file_size') };
  }
  return { isValid: true, message: '' };
};

const uploadSubtitle = async (file: File, title: string, language: Language) => {
  const content = getContent(await file.arrayBuffer(), language);
  const body = getSubtitle(file, content);
  await addRegisteredSubtitle({ title, language, body });
};

const getContent = (arrayBuffer: ArrayBuffer, language: Language) => {
  const encodings = Object.values(ENCODING_MAP).sort((a, b) => {
    if (a === ENCODING_MAP.UTF_8) return -1;
    if (b === ENCODING_MAP.UTF_8) return 1;

    const languageEncoding = LANGUAGE_ENCODING_MAP[language];
    if (a === languageEncoding) return -1;
    if (b === languageEncoding) return 1;

    return 0;
  });

  for (const encoding of encodings) {
    try {
      const decoder = new TextDecoder(encoding, { fatal: true });
      const content = decoder.decode(arrayBuffer);
      return content;
    } catch {
      continue;
    }
  }

  throw new Error('Failed to decode subtitle file');
};

const getSubtitle = (file: File, content: string) => {
  const fileExtension = getSubtitleFormat(file);
  if (!fileExtension) return [];
  return parseSubtitle[fileExtension](content);
};

export function SubtitleUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (file: File) => {
    const { isValid, message } = validateFile(file);
    if (isValid) {
      setFile(file);
      setTitle(file.name.replace(/\.[^.]+$/, ''));
    } else {
      modal.alert({ title: t('error'), message });
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
            <FileTextIcon className='size-5 shrink-0' />
            <span className='text-[15px] font-bold truncate'>{file.name}</span>
          </>
        ) : (
          <>
            <FileUpIcon className='size-5' />
            <span className='text-[15px] font-bold'>{t('upload_subtitle_file')}</span>
            <span className='text-[12px] text-gray-500'>{allowedExtensionsString}</span>
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
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsUploading(true);
            try {
              await uploadSubtitle(file, title, language);
              reset();
            } catch (error) {
              console.error('Failed to process subtitle file:', error);
            } finally {
              setIsUploading(false);
            }
          }}
          className={`flex flex-col gap-2 border rounded-md p-4 ${isUploading ? 'opacity-50' : ''}`}
        >
          <div className='flex justify-between items-center gap-1'>
            <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
              <SelectTrigger className='w-fit'>
                <SelectValue placeholder={t('select')} />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isUploading} />
          </div>
          <div className='flex gap-2'>
            <Button type='button' variant='outline' className='w-full' onClick={reset} disabled={isUploading}>
              {t('cancel')}
            </Button>
            <Button type='submit' className='w-full' disabled={isUploading}>
              {t('upload')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
