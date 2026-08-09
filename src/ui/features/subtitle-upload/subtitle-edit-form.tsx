
import { useEffect, useId, useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { CheckIcon, XIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ui/components/select';

import { LANGUAGE_OPTIONS } from './subtitle-uploader';

interface SubtitleEditFormProps {
  id: SubtitleId;
  initialTitle: string;
  initialLanguage: Language;
  onEdit: (id: SubtitleId, title: string, language: Language) => Promise<void>;
  closeEditMode: () => void;
}

export function SubtitleEditForm({ id, initialTitle, initialLanguage, onEdit, closeEditMode }: SubtitleEditFormProps) {
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [editedLanguage, setEditedLanguage] = useState(initialLanguage);
  const [error, setError] = useState<string>();
  const [focusSaveRequest, setFocusSaveRequest] = useState(0);
  const [pending, setPending] = useState(false);
  const errorId = useId();
  const handledFocusSaveRequestRef = useRef(0);
  const pendingRef = useRef(false);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (pending || focusSaveRequest === handledFocusSaveRequestRef.current) return;
    handledFocusSaveRequestRef.current = focusSaveRequest;
    saveButtonRef.current?.focus();
  }, [focusSaveRequest, pending]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pendingRef.current) return;

    pendingRef.current = true;
    setPending(true);
    setError(undefined);
    try {
      await onEdit(id, editedTitle, editedLanguage);
    } catch {
      setError(t('error_try_later'));
      setFocusSaveRequest((request) => request + 1);
      return;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
    closeEditMode();
  };

  return (
    <form
      className='flex min-w-0 flex-col gap-2'
      aria-busy={pending || undefined}
      aria-describedby={error ? errorId : undefined}
      onSubmit={handleSubmit}
    >
      <Select
        value={editedLanguage}
        disabled={pending}
        onValueChange={(value) => {
          setEditedLanguage(value as Language);
          setError(undefined);
        }}
      >
        <SelectTrigger className='w-full' aria-label={t('language')}>
          <SelectValue placeholder={t('language')} />
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
        value={editedTitle}
        disabled={pending}
        onChange={(e) => {
          setEditedTitle(e.target.value);
          setError(undefined);
        }}
      />
      {error && (
        <p id={errorId} role='alert' className='text-wrap text-sm text-destructive'>
          {error}
        </p>
      )}
      {pending && (
        <p role='status' className='sr-only'>
          {t('saving')}
        </p>
      )}
      <div className='grid grid-cols-2 gap-2'>
        <Button variant='outline' size='sm' type='button' disabled={pending} onClick={closeEditMode}>
          <XIcon />
          {t('cancel')}
        </Button>
        <Button ref={saveButtonRef} size='sm' type='submit' disabled={pending}>
          <CheckIcon />
          {t(pending ? 'saving' : 'save')}
        </Button>
      </div>
    </form>
  );
}
