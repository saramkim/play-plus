export const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

export const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';

export const RESERVED_KEY_CODE_LIST = [
  'ArrowRight',
  'ArrowLeft',
  'ArrowUp',
  'ArrowDown',
  'Enter',
  'Space',
  'Escape',
  'KeyF',
];

export const SUBTITLES = {
  ENGLISH: {
    LANGUAGE_CODE: 'en',
    STORAGE_KEY: 'englishSubtitle',
    CONTAINER_ID: 'english-subtitle-setting',
    TOGGLE_ID: 'english-toggle',
    COLOR_PICKER_ID: 'english-color-picker',
    FONT_SIZE_INPUT_ID: 'english-font-size',
    FONT_WEIGHT_INPUT_ID: 'english-font-weight',
    CANCEL_BUTTON_ID: 'cancel-english-setting',
    SAVE_BUTTON_ID: 'save-english-setting',
  },
  KOREAN: {
    LANGUAGE_CODE: 'ko',
    STORAGE_KEY: 'koreanSubtitle',
    CONTAINER_ID: 'korean-subtitle-setting',
    TOGGLE_ID: 'korean-toggle',
    COLOR_PICKER_ID: 'korean-color-picker',
    FONT_SIZE_INPUT_ID: 'korean-font-size',
    FONT_WEIGHT_INPUT_ID: 'korean-font-weight',
    CANCEL_BUTTON_ID: 'cancel-korean-setting',
    SAVE_BUTTON_ID: 'save-korean-setting',
  },
} as const;

export const SKIP_TIME = {
  STORAGE_KEY: 'skipTime',
  INPUT_ID: 'skip-time',
  CANCEL_BUTTON_ID: 'cancel-skip-time',
  SAVE_BUTTON_ID: 'save-skip-time',
} as const;

export const SUB_KEY = {
  STORAGE_KEY: 'subKey',
  CONTAINER_ID: 'sub-key-setting',
  TOGGLE_ID: 'sub-key-toggle',
  BACKWARD_INPUT_ID: 'sub-backward-key',
  FORWARD_INPUT_ID: 'sub-forward-key',
  SKIP_TIME_INPUT_ID: 'sub-skip-time',
  CANCEL_BUTTON_ID: 'cancel-sub-key',
  SAVE_BUTTON_ID: 'save-sub-key',
} as const;

export const INPUT_ID_TO_STORAGE_OPTION_KEY = {
  [SUBTITLES.ENGLISH.FONT_SIZE_INPUT_ID]: 'fontSize',
  [SUBTITLES.KOREAN.FONT_SIZE_INPUT_ID]: 'fontSize',
  [SUBTITLES.ENGLISH.FONT_WEIGHT_INPUT_ID]: 'fontWeight',
  [SUBTITLES.KOREAN.FONT_WEIGHT_INPUT_ID]: 'fontWeight',
  [SKIP_TIME.INPUT_ID]: 'skipTime',
  [SUB_KEY.BACKWARD_INPUT_ID]: 'backward',
  [SUB_KEY.FORWARD_INPUT_ID]: 'forward',
  [SUB_KEY.SKIP_TIME_INPUT_ID]: 'skipTime',
} as const;

export type InputId = keyof typeof INPUT_ID_TO_STORAGE_OPTION_KEY;
