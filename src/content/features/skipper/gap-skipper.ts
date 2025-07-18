import { findSubtitleIndex } from '@utils/helper';

import { useVideoStore } from '@/content/core/store/video-store';
import { videoManager } from '@/content/core/video/video-manager';
import { findTargetSubtitle } from '@/content/features/navigation/video-navigation';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

import { useGapSkipperStore } from './gap-skipper-store';

class GapSkipper {
  private unsubscribe: (() => void) | null = null;

  start() {
    if (this.unsubscribe) return;

    this.unsubscribe = useVideoStore.subscribe(({ currentTime }) => {
      const video = videoManager.get();
      if (!video) return;

      const subtitles = useSubtitleStore.getState().getPrimarySubtitle();
      if (!subtitles || subtitles.length === 0) return;

      const currentIndex = findSubtitleIndex(subtitles, currentTime);
      const currentSubtitle = subtitles[currentIndex];
      const nextSubtitle = findTargetSubtitle(subtitles, currentIndex, 1);

      if (!currentSubtitle && nextSubtitle) {
        video.currentTime = nextSubtitle.start;
      }
    });

    useGapSkipperStore.getState().setEnabled(true);
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    useGapSkipperStore.getState().setEnabled(false);
  }
}

export const gapSkipper = new GapSkipper();
