import { SubtitleId } from '@storage/subtitle';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { useImportedSubtitles } from '@/ui/features/subtitle-import/use-imported-subtitles';

interface RegisteredSubtitleSelectProps {
  selectedId: SubtitleId | null;
  onSelect: (subtitleId: SubtitleId) => void;
}

export function RegisteredSubtitleSelect({ selectedId, onSelect }: RegisteredSubtitleSelectProps) {
  const { subtitles } = useImportedSubtitles();

  if (subtitles.length === 0) return null;

  return (
    <Select value={selectedId || ''} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder={t('imported_subtitles')} />
      </SelectTrigger>
      <SelectContent>
        {subtitles.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {`${option.title} (${t(LANGUAGES[option.language])})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
