import { Language } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

import { CoupangPlayStrategy } from './coupang-play';

export interface VideoStrategy {
  detectVideo(): HTMLVideoElement | Promise<HTMLVideoElement | null> | null;
  getVideoPlayer(): Element | null;
  getProgressBarContainer(): Element | null;
  fetchSubtitles(
    url: string,
    headers: chrome.webRequest.HttpHeader[]
  ): Promise<{ lang: Language; subtitleData: SubtitleData[] }[] | null>;
}

export const coupangStrategy: VideoStrategy = new CoupangPlayStrategy();
