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

export const SETTINGS = {
  SUBTITLES: {
    ENGLISH: {
      LANGUAGE_CODE: 'en',
      STORAGE_KEY: 'englishSubtitle',
      CONTAINER_ID: 'english-subtitle-setting',
      TOGGLE_ID: 'english-toggle',
      INPUTS: {
        color: 'english-color-picker',
        fontSize: 'english-font-size',
        fontWeight: 'english-font-weight',
        opacity: 'english-opacity',
        lineBreak: 'english-line-break',
      },
      BUTTONS: {
        CANCEL: 'cancel-english-setting',
        SAVE: 'save-english-setting',
      },
    },
    KOREAN: {
      LANGUAGE_CODE: 'ko',
      STORAGE_KEY: 'koreanSubtitle',
      CONTAINER_ID: 'korean-subtitle-setting',
      TOGGLE_ID: 'korean-toggle',
      INPUTS: {
        color: 'korean-color-picker',
        fontSize: 'korean-font-size',
        fontWeight: 'korean-font-weight',
        opacity: 'korean-opacity',
        lineBreak: 'korean-line-break',
      },
      BUTTONS: {
        CANCEL: 'cancel-korean-setting',
        SAVE: 'save-korean-setting',
      },
    },
  },
  SKIP_TIME: {
    STORAGE_KEY: 'skipTime',
    INPUTS: {
      skipTime: 'skip-time',
    },
    BUTTONS: {
      CANCEL: 'cancel-skip-time',
      SAVE: 'save-skip-time',
    },
  },
  SUB_KEY: {
    STORAGE_KEY: 'subKey',
    CONTAINER_ID: 'sub-key-setting',
    TOGGLE_ID: 'sub-key-toggle',
    INPUTS: {
      backward: 'sub-backward-key',
      forward: 'sub-forward-key',
      skipTime: 'sub-skip-time',
    },
    BUTTONS: {
      CANCEL: 'cancel-sub-key',
      SAVE: 'save-sub-key',
    },
  },
} as const;

export const INPUT_ID_TO_STORAGE_OPTION_KEY = generateInputToStorageKey(SETTINGS);

export type InputId = keyof typeof INPUT_ID_TO_STORAGE_OPTION_KEY;

function generateInputToStorageKey(settings: typeof SETTINGS): Record<string, string> {
  const mapping: Record<string, string> = {};

  Object.values(settings).forEach((category) => {
    if ('INPUTS' in category) {
      Object.entries(category.INPUTS).forEach(([storageKey, inputId]) => {
        mapping[inputId] = storageKey;
      });
    } else {
      Object.values(category).forEach((subCategory) => {
        if ('INPUTS' in subCategory) {
          Object.entries(subCategory.INPUTS).forEach(([storageKey, inputId]) => {
            mapping[inputId] = storageKey;
          });
        }
      });
    }
  });

  return mapping;
}
