
import { useState } from 'react';

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await onEdit(id, editedTitle, editedLanguage);
      closeEditMode();
    } catch {
      console.error('Failed to edit the registered subtitle');
    }
  };

  return (
    <form className='flex min-w-0 flex-col gap-2' onSubmit={handleSubmit}>
      <Select value={editedLanguage} onValueChange={(value) => setEditedLanguage(value as Language)}>
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
      <Input aria-label={t('subtitle_title')} value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
      <div className='grid grid-cols-2 gap-2'>
        <Button variant='outline' size='sm' type='button' onClick={closeEditMode}>
          <XIcon />
          {t('cancel')}
        </Button>
        <Button size='sm' type='submit'>
          <CheckIcon />
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
