
import { useRef, useState } from 'react';

import { SubtitleId } from '@storage/subtitle';
import { Language } from '@utils/constants';
import { t } from '@utils/i18n';
import { CheckIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import { Input } from '@/ui/components/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ui/components/select';
import { useClickOutside } from '@/ui/hooks/use-click-outside';

import { LANGUAGE_OPTIONS } from './subtitle-uploader';

interface SubtitleEditFormProps {
  id: SubtitleId;
  initialTitle: string;
  initialLanguage: Language;
  onEdit: (id: SubtitleId, title: string, language: Language) => Promise<unknown>;
  closeEditMode: () => void;
}

export function SubtitleEditForm({ id, initialTitle, initialLanguage, onEdit, closeEditMode }: SubtitleEditFormProps) {
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [editedLanguage, setEditedLanguage] = useState(initialLanguage);
  const formRef = useRef<HTMLFormElement>(null);
  const selectContentRef = useRef<HTMLDivElement>(null);

  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useClickOutside([formRef, selectContentRef], () => { if (!pendingRef.current) closeEditMode(); });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError('');
    try {
      await onEdit(id, editedTitle, editedLanguage);
      closeEditMode();
    } catch {
      setError(t('error_try_later'));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  return (
    <form className='flex flex-col gap-1' onSubmit={handleSubmit} ref={formRef}>
      <div className='flex items-center gap-1'>
      <Select disabled={pending} value={editedLanguage} onValueChange={(value) => { if (!pendingRef.current) setEditedLanguage(value as Language); }}>
        <SelectTrigger className='w-fit'>
          <SelectValue placeholder={t('language')} />
        </SelectTrigger>
        <SelectContent ref={selectContentRef}>
          {LANGUAGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input disabled={pending} value={editedTitle} onChange={(e) => { if (!pendingRef.current) setEditedTitle(e.target.value); }} />
      <Button disabled={pending} variant='outline' size='sm' type='submit'>
        <CheckIcon />
      </Button>
      </div>
      {error && <p role='alert' className='w-full'>{error}</p>}
    </form>
  );
}
