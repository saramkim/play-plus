import { useRef, useState } from 'react';

import { CheckIcon } from '@heroicons/react/24/outline';
import { SubtitleId } from '@storage/subtitle';
import { Language } from '@utils/constants';
import { t } from '@utils/i18n';

import { Input } from '@/ui/components/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/ui/components/select';
import { useClickOutside } from '@/ui/hooks/use-click-outside';

import { LANGUAGE_OPTIONS } from './subtitle-uploader';
import { Button } from '@/ui/components/button';

interface SubtitleEditFormProps {
  id: SubtitleId;
  initialTitle: string;
  initialLanguage: Language;
  onEdit: (id: SubtitleId, title: string, language: Language) => void;
  closeEditMode: () => void;
}

export function SubtitleEditForm({ id, initialTitle, initialLanguage, onEdit, closeEditMode }: SubtitleEditFormProps) {
  const [editedTitle, setEditedTitle] = useState(initialTitle);
  const [editedLanguage, setEditedLanguage] = useState(initialLanguage);
  const formRef = useRef<HTMLFormElement>(null);
  const selectContentRef = useRef<HTMLDivElement>(null);

  useClickOutside([formRef, selectContentRef], () => closeEditMode());

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onEdit(id, editedTitle, editedLanguage);
    closeEditMode();
  };

  return (
    <form className='flex items-center gap-1' onSubmit={handleSubmit} ref={formRef}>
      <Select value={editedLanguage} onValueChange={(value) => setEditedLanguage(value as Language)}>
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
      <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
      <Button variant='outline' size='sm' type='submit'>
        <CheckIcon />
      </Button>
    </form>
  );
}
