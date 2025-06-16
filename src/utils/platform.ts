export const PLATFORM_MAP = {
  coupangPlay: {
    url: 'https://www.coupangplay.com',
    videoUrl: 'https://www.coupangplay.com/play',
    subtitleApiUrl: 'https://www.coupangplay.com/api/playback/play',
  },
} as const;

export type PlatformName = keyof typeof PLATFORM_MAP;

export const PLATFORM_URL_LIST = Object.values(PLATFORM_MAP).map((platform) => platform.url);
export const PLATFORM_VIDEO_URL_LIST = Object.values(PLATFORM_MAP).map((platform) => platform.videoUrl);
