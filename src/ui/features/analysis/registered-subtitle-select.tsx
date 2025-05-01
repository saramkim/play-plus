import { SubtitleId } from '@storage/subtitle';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { useRegisteredSubtitles } from '@/ui/features/subtitle/use-registered-subtitles';

interface RegisteredSubtitleSelectProps {
  selectedId: SubtitleId | null;
  onSelect: (subtitleId: SubtitleId) => void;
}

export function RegisteredSubtitleSelect({ selectedId, onSelect }: RegisteredSubtitleSelectProps) {
  const { subtitles } = useRegisteredSubtitles();
  return (
    <Select value={selectedId || ''} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder={t('registered_subtitle')} />
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
