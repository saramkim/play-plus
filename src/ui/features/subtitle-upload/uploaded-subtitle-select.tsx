import { SubtitleId } from '@storage/subtitle';
import { LANGUAGES } from '@utils/constants';
import { t } from '@utils/i18n';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/components/select';
import { useUploadedSubtitles } from '@/ui/features/subtitle-upload/use-uploaded-subtitles';

interface UploadedSubtitleSelectProps {
  selectedId: SubtitleId | null;
  onSelect: (subtitleId: SubtitleId) => void;
}

export function UploadedSubtitleSelect({ selectedId, onSelect }: UploadedSubtitleSelectProps) {
  const { subtitles } = useUploadedSubtitles();

  if (subtitles.length === 0) return null;

  return (
    <Select value={selectedId || ''} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder={t('uploaded_subtitles')} />
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
