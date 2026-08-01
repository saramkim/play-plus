
import { useRef, useState } from 'react';

import { Language, LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';
import {
  decodeSubtitleBytes,
  MAX_SUBTITLE_FILE_SIZE,
  SubtitleDecodeError,
} from '@utils/subtitle-decode';
import { FileTextIcon, FileUpIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';

import {
  isSupportedSubtitleFileName,
  registerSubtitleText,
  SubtitleRegistrationError,
  SUPPORTED_SUBTITLE_EXTENSIONS,
  subtitleTitleFromFileName,
} from './subtitle-registration';

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGES).map(([key, value]) => ({
  value: key,
  label: t(value),
}));
const DEFAULT_LANGUAGE: Language = 'en';

const allowedExtensionsString = SUPPORTED_SUBTITLE_EXTENSIONS.map((extension) =>
  extension.replace('.', '').toUpperCase()
).join(', ');

const validateFile = (file: File) => {
  if (!isSupportedSubtitleFileName(file.name)) {
    return { isValid: false, message: t('error_unsupported_file_type', allowedExtensionsString) };
  }
  if (file.size > MAX_SUBTITLE_FILE_SIZE) {
    return { isValid: false, message: t('error_file_size') };
  }
  return { isValid: true, message: '' };
};

const registrationErrorMessage = (error: unknown) => {
  if (error instanceof SubtitleRegistrationError) {
    return error.code === 'unsupported-file-type'
      ? t('error_unsupported_file_type', allowedExtensionsString)
      : t('error_empty_subtitle');
  }
  return t('error_try_later');
};

export function SubtitleUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (file: File) => {
    const { isValid, message } = validateFile(file);
    if (isValid) {
      setError(null);
      setFile(file);
      setTitle(subtitleTitleFromFileName(file.name));
    } else {
      setFile(null);
      setTitle('');
      setError(message);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const reset = () => {
    setFile(null);
    setTitle('');
    setLanguage(DEFAULT_LANGUAGE);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className='flex flex-col gap-2'>
      <button
        type='button'
        aria-label={t('upload_subtitle_file')}
        className='flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border p-4 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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

      </button>

      <input
        ref={fileInputRef}
        type='file'
        accept={SUPPORTED_SUBTITLE_EXTENSIONS.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className='hidden'
      />

      {error && (
        <p role='alert' className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-wrap text-[13px] text-destructive'>
          {error}
        </p>
      )}

      {file && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsUploading(true);
            setError(null);
            try {
              let text: string;
              try {
                text = decodeSubtitleBytes(await file.arrayBuffer(), language);
              } catch (decodeError) {
                setError(
                  decodeError instanceof SubtitleDecodeError && decodeError.code === 'FILE_TOO_LARGE'
                    ? t('error_file_size')
                    : t('error_subtitle_decode')
                );
                return;
              }
              await registerSubtitleText({ fileName: file.name, title, language, text });
              toast.success(t('success_add_subtitle'));
              reset();
            } catch (error) {
              setError(registrationErrorMessage(error));
            } finally {
              setIsUploading(false);
            }
          }}
          className={`flex flex-col gap-2 border rounded-md p-4 ${isUploading ? 'opacity-50' : ''}`}
        >
          <div className='flex justify-between items-center gap-1'>
            <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
              <SelectTrigger className='w-fit' aria-label={t('language')}>
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
            <Input
              aria-label={t('subtitle_title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isUploading}
              required
            />
          </div>
          <div className='flex gap-2'>
            <Button type='button' variant='outline' className='w-full' onClick={reset} disabled={isUploading}>
              {t('cancel')}
            </Button>
            <Button type='submit' className='w-full' disabled={isUploading || !title.trim()}>
              {t('add')}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
