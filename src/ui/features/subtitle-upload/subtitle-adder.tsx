import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';

import { SubtitleUploader } from './subtitle-uploader';

interface SubtitleAdderProps {
  focusFirstControl?: boolean;
  onAdded: (subtitle: V2RegisteredSubtitleMetadata) => void;
  onBusyChange: (busy: boolean) => void;
}

export function SubtitleAdder({
  focusFirstControl = false,
  onAdded,
  onBusyChange,
}: SubtitleAdderProps) {
  return (
    <SubtitleUploader
      focusOnMount={focusFirstControl}
      onAdded={onAdded}
      onBusyChange={onBusyChange}
    />
  );
}
