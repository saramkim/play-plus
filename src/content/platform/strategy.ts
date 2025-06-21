import { Language } from '@utils/constants';
import { SubtitleData } from '@utils/parse';
import { PLATFORM_MAP, PlatformName } from '@utils/platform';

import { CoupangPlayStrategy } from './coupang-play';
import { YoutubeStrategy } from './youtube';

export interface PlatformStrategy {
  detectVideo(): HTMLVideoElement | Promise<HTMLVideoElement | null> | null;
  getTrackDisplayContainer(): Element | null;
  getProgressBarContainer(): Element | null;
  fetchSubtitles(
    url: string,
    headers: chrome.webRequest.HttpHeader[]
  ): Promise<{ lang: Language; subtitleData: SubtitleData[] }[] | null>;
  afterVideoDetected?(video: HTMLVideoElement): void;
}

const PlatformStrategyMap: Record<PlatformName, new () => PlatformStrategy> = {
  coupangPlay: CoupangPlayStrategy,
  youtube: YoutubeStrategy,
};

const getPlatformStrategy = (url: string) => {
  for (const [name, platform] of Object.entries(PLATFORM_MAP)) {
    if (url.startsWith(platform.url)) {
      return new PlatformStrategyMap[name]();
    }
  }

  console.error('Platform not found', url);
  throw new Error('Platform not found');
};

export const platform = getPlatformStrategy(window.location.href);
