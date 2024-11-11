import { SubtitleConfig } from './storage';

export const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

export const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';

export const FEEDBACK_DISPLAY_DURATION = 800;

export const DEFAULT_SKIP_TIME = 10;

export const SUBTITLES = {
  ENGLISH: {
    LANGUAGE_CODE: 'en',
    STORAGE_KEY: 'englishSubtitle',
    CONTAINER_ID: 'english-subtitle-setting',
    TOGGLE_ID: 'english-toggle',
    COLOR_PICKER_ID: 'english-color-picker',
    FONT_SIZE_INPUT_ID: 'english-font-size',
    SAVE_BUTTON_ID: 'save-english-setting',
  },
  KOREAN: {
    LANGUAGE_CODE: 'ko',
    STORAGE_KEY: 'koreanSubtitle',
    CONTAINER_ID: 'korean-subtitle-setting',
    TOGGLE_ID: 'korean-toggle',
    COLOR_PICKER_ID: 'korean-color-picker',
    FONT_SIZE_INPUT_ID: 'korean-font-size',
    SAVE_BUTTON_ID: 'save-korean-setting',
  },
} as const;

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  enabled: false,
  color: '#ffffff',
  fontSize: 5,
};
