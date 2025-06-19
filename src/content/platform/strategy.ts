import { PLATFORM_MAP, PlatformName } from '@utils/platform';

import { CoupangPlayStrategy } from './coupang-play';
import { YoutubeStrategy } from './youtube';

export interface PlatformStrategy {
  detectVideo(): HTMLVideoElement | Promise<HTMLVideoElement> | null;
  getTrackDisplayContainer(): Element | null;
  getProgressBarContainer(): Element | null;
}

const PlatformStrategyMap: Record<PlatformName, new () => PlatformStrategy> = {
  coupangPlay: CoupangPlayStrategy,
  youtube: YoutubeStrategy,
};

export const getPlatformStrategy = (url: string) => {
  for (const [name, platform] of Object.entries(PLATFORM_MAP)) {
    if (url.startsWith(platform.url)) {
      return new PlatformStrategyMap[name]();
    }
  }

  console.error('Platform not found', url);
  throw new Error('Platform not found');
};
