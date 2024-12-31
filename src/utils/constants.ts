export const COUPANG_PLAY_BASE_URL = 'https://www.coupangplay.com';

export const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

export const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
export const SUBTITLE_TOOLTIP_ID = 'pp-subtitle-tooltip';
export const TOAST_CONTAINER_ID = 'pp-toast-container';

export const PAGE_NAME = {
  SUBTITLE_SETTING: 'subtitle-setting',
  VIDEO_SETTING: 'video-setting',
  SAVED_SUBTITLES: 'saved-subtitles',
} as const;
export type PageName = (typeof PAGE_NAME)[keyof typeof PAGE_NAME];

export const SETTINGS = {
  SUBTITLES: {
    PRIMARY: {
      STORAGE_KEY: 'primarySubtitle',
      TITLE_MESSAGE_KEY: 'primary_subtitle',
    },
    SECONDARY: {
      STORAGE_KEY: 'secondarySubtitle',
      TITLE_MESSAGE_KEY: 'secondary_subtitle',
    },
  },
  VIDEO_SKIP: {
    STORAGE_KEY: 'videoSkip',
    TITLE_MESSAGE_KEY: 'video_skip',
  },
  SUB_VIDEO_SKIP: {
    STORAGE_KEY: 'subVideoSkip',
    TITLE_MESSAGE_KEY: 'sub_video_skip',
  },
  SHORTCUTS: {
    STORAGE_KEY: 'shortcuts',
    CONTAINER_ID: 'shortcuts-setting',
  },
} as const;

export const REVIEW = {
  STORAGE_KEY: 'savedSubtitles',
  DATA_ATTRIBUTE: {
    START_TIME: 'startTime',
  },
  ACTIONS: {
    VIEW_VIDEO: 'viewVideo',
    PLAY_VIDEO: 'playVideo',
  },
} as const;
