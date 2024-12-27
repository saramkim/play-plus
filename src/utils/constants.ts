export const COUPANG_PLAY_BASE_URL = 'https://www.coupangplay.com';

export const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

export const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
export const SUBTITLE_TOOLTIP_ID = 'pp-subtitle-tooltip';
export const TOAST_CONTAINER_ID = 'pp-toast-container';

export const POPUP_CONTAINER_ID = 'popup-container';

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
      SECTION_ID: 'primary-subtitle-section',
      TITLE_MESSAGE_KEY: 'primary_subtitle',
      CONTAINER_ID: 'primary-subtitle-setting',
      TOGGLE_ID: 'primary-subtitle-toggle',
      INPUTS: {
        language: 'primary-subtitle-language',
        positionReference: 'primary-subtitle-position-reference',
        positionOffset: 'primary-subtitle-position-offset',
        color: 'primary-subtitle-color',
        fontSize: 'primary-subtitle-font-size',
        fontWeight: 'primary-subtitle-font-weight',
        opacity: 'primary-subtitle-opacity',
        lineBreak: 'primary-subtitle-line-break',
      },
      BUTTONS: {
        CANCEL: 'cancel-primary-subtitle-setting',
        SAVE: 'save-primary-subtitle-setting',
      },
    },
    SECONDARY: {
      STORAGE_KEY: 'secondarySubtitle',
      SECTION_ID: 'secondary-subtitle-section',
      TITLE_MESSAGE_KEY: 'secondary_subtitle',
      CONTAINER_ID: 'secondary-subtitle-setting',
      TOGGLE_ID: 'secondary-subtitle-toggle',
      INPUTS: {
        language: 'secondary-subtitle-language',
        positionReference: 'secondary-subtitle-position-reference',
        positionOffset: 'secondary-subtitle-position-offset',
        color: 'secondary-subtitle-color',
        fontSize: 'secondary-subtitle-font-size',
        fontWeight: 'secondary-subtitle-font-weight',
        opacity: 'secondary-subtitle-opacity',
        lineBreak: 'secondary-subtitle-line-break',
      },
      BUTTONS: {
        CANCEL: 'cancel-secondary-subtitle-setting',
        SAVE: 'save-secondary-subtitle-setting',
      },
    },
  },
  VIDEO_SKIP: {
    STORAGE_KEY: 'videoSkip',
    SECTION_ID: 'video-skip-section',
    TITLE_MESSAGE_KEY: 'video_skip',
    CONTAINER_ID: 'video-skip-setting',
    TOGGLE_ID: 'video-skip-toggle',
    INPUTS: {
      backward: 'video-skip-backward-key',
      forward: 'video-skip-forward-key',
      skipTime: 'video-skip-time',
    },
    SKIP_TIME_UNIT: 'video-skip-time-unit',
    BUTTONS: {
      CANCEL: 'cancel-video-skip',
      SAVE: 'save-video-skip',
    },
  },
  SUB_VIDEO_SKIP: {
    STORAGE_KEY: 'subVideoSkip',
    SECTION_ID: 'sub-video-skip-section',
    TITLE_MESSAGE_KEY: 'sub_video_skip',
    CONTAINER_ID: 'sub-video-skip-setting',
    TOGGLE_ID: 'sub-video-skip-toggle',
    INPUTS: {
      backward: 'sub-backward-key',
      forward: 'sub-forward-key',
      skipTime: 'sub-skip-time',
    },
    SKIP_TIME_UNIT: 'sub-skip-time-unit',
    BUTTONS: {
      CANCEL: 'cancel-sub-video-skip',
      SAVE: 'save-sub-video-skip',
    },
  },
  SHORTCUTS: {
    STORAGE_KEY: 'shortcuts',
    SECTION_ID: 'shortcuts-section',
    CONTAINER_ID: 'shortcuts-setting',
    TOGGLE_ID: 'shortcuts-toggle',
    INPUTS: {
      savePrimary: 'save-primary-shortcuts',
      saveSecondary: 'save-secondary-shortcuts',
      togglePrimary: 'toggle-primary-shortcuts',
      toggleSecondary: 'toggle-secondary-shortcuts',
    },
    BUTTONS: {
      CANCEL: 'cancel-shortcuts',
      SAVE: 'save-shortcuts',
    },
  },
} as const;

export const REVIEW = {
  STORAGE_KEY: 'savedSubtitles',
  DATA_ATTRIBUTE: {
    START_TIME: 'startTime',
  },
  HEADER_ID: 'saved-subtitle-header',
  CONTAINER_ID: 'saved-subtitle-container',
  ACTIONS: {
    VIEW_VIDEO: 'viewVideo',
    PLAY_VIDEO: 'playVideo',
  },
} as const;
