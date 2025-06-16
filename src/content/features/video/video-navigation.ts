import { StorageSchema } from '@storage/type';
import { findSubtitleIndex } from '@utils/helper';
import { SubtitleData } from '@utils/parse';

import { loopController } from '@/content/features/loop';
import { elementStore } from '@/content/store/element-store';
import { subtitleStore } from '@/content/store/subtitle-store';

export function skipVideoTime(
  skipTime: number,
  skipTimeUnit: StorageSchema['videoSkip']['skipTimeUnit'],
  fallbackTime: number,
  fallbackUnit: StorageSchema['videoSkip']['fallbackUnit']
) {
  const video = elementStore.getVideoElement();
  if (!video) return;

  if (skipTimeUnit === 'subtitles') {
    skipVideoBySubtitles(video, skipTime, fallbackTime, fallbackUnit);
  } else {
    skipVideoByTime(video, skipTime, skipTimeUnit);
  }
}

function skipVideoBySubtitles(
  video: HTMLVideoElement,
  skipTime: number,
  fallbackTime: number,
  fallbackUnit: StorageSchema['videoSkip']['fallbackUnit']
) {
  const { currentTime, duration } = video;
  const { subtitles, delay } = subtitleStore.getPrimarySubtitleAndDelay();

  if (!subtitles?.length) {
    skipVideoByTime(video, fallbackTime, fallbackUnit);
    return;
  }

  const currentIndex = findSubtitleIndex(subtitles, currentTime - delay);
  const targetSubtitle = findTargetSubtitle(subtitles, currentIndex, skipTime);

  if (targetSubtitle) {
    jumpToSubtitle(video, targetSubtitle, delay);
  } else {
    video.currentTime = skipTime > 0 ? duration - 1 : 0;
  }
}

function findTargetSubtitle(
  subtitles: SubtitleData[],
  currentIndex: number,
  skipTime: number
): SubtitleData | undefined {
  const targetIndex = skipTime > 0 ? Math.floor(currentIndex) + skipTime : Math.ceil(currentIndex) + skipTime;
  return subtitles[targetIndex];
}

function jumpToSubtitle(video: HTMLVideoElement, subtitle: SubtitleData, delay: number) {
  const startTime = subtitle.start + delay;
  video.currentTime = startTime;

  if (loopController.getLoopType() === 'subtitle') {
    loopController.setStartPoint(startTime);
    loopController.setEndPoint(subtitle.end + delay);
  }
}

function skipVideoByTime(
  video: HTMLVideoElement,
  skipTime: number,
  skipTimeUnit: StorageSchema['videoSkip']['fallbackUnit']
) {
  const { currentTime, duration } = video;
  const unitMap = { seconds: 1, minutes: 60 };
  const time = currentTime + skipTime * unitMap[skipTimeUnit];

  video.currentTime = Math.min(Math.max(time, 0), duration - 1);
}
