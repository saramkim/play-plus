import { useFocusModeStore } from '@/content/store/focus-mode-store';

import { FocusMode } from './focus-mode';
import { SubtitleContainer } from './subtitle-container';

export function Subtitles() {
  const isFocusMode = useFocusModeStore((state) => state.isFocusMode);

  return isFocusMode ? <FocusMode /> : <SubtitleContainer />;
}
