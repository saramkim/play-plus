import { useRef, useState } from 'react';
import { usePopup } from '../contexts/PopupContext';
import { getMessage } from '../utils/i18n';
import MessagePopup from './MessagePopup';
import { ArrowUpTrayIcon } from '@heroicons/react/20/solid';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

interface SubtitleUploaderProps {
  onUpload: (file: File, title: string) => Promise<void>;
}

const allowedExtensions = ['.srt', '.vtt'];

const validateFile = (file: File) => {
  const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(fileExtension)) {
    return { isValid: false, message: getMessage('error_unsupported_file_type') };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { isValid: false, message: getMessage('error_file_size') };
  }
  return { isValid: true, message: '' };
};

const SubtitleUploader = ({ onUpload }: SubtitleUploaderProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
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
        title: getMessage('error'),
        content: <MessagePopup message={message} type='alert' hidePopup={hidePopup} />,
        status: 'error',
      });
    }
  };

  const reset = () => {
    setFile(null);
    setTitle('');
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
            <DocumentTextIcon className='size-5' />
            <span className='text-[15px] font-bold truncate'>{file.name}</span>
          </>
        ) : (
          <>
            <ArrowUpTrayIcon className='size-5' />
            <span className='text-[15px] font-bold'>{getMessage('upload_subtitle_file')}</span>
            <span className='text-[12px] text-gray-500'>SRT, VTT</span>
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
          <input
            type='text'
            className='input'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUploading}
          />
          <div className='flex gap-2'>
            <button
              className='w-full bg-gray-500 text-white rounded-full p-2 font-medium'
              onClick={reset}
              disabled={isUploading}
            >
              {getMessage('cancel')}
            </button>
            <button
              className='w-full bg-teal-500 text-white rounded-full p-2 font-medium'
              onClick={async () => {
                setIsUploading(true);
                await onUpload(file, title);
                setIsUploading(false);
                reset();
              }}
              disabled={isUploading}
            >
              {getMessage('register')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleUploader;
