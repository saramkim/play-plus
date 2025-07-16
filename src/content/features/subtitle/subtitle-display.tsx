import { FocusMode } from '@/content/features/focus-mode/focus-mode';
import { useFocusModeStore } from '@/content/features/focus-mode/focus-mode-store';
import { SubtitleContainer } from '@/content/features/subtitle/subtitle-container';

export function SubtitleDisplay() {
  const isFocusMode = useFocusModeStore((state) => state.isFocusMode);
  return isFocusMode ? <FocusMode /> : <SubtitleContainer />;
}
