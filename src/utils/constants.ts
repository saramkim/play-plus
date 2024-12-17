export const COUPANG_PLAY_BASE_URL = 'https://www.coupangplay.com';

export const TRACK_DISPLAY_CONTAINER_CLASS_NAME = 'vjs-text-track-display';

export const SUBTITLE_CONTAINER_ID = 'pp-subtitle-container';
export const SUBTITLE_TOOLTIP_ID = 'pp-subtitle-tooltip';
export const TOAST_CONTAINER_ID = 'pp-toast-container';

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

export const PAGE_NAME = {
  SETTING: 'setting',
  REVIEW: 'review',
} as const;

export const SETTINGS = {
  SUBTITLES: {
    PRIMARY: {
      STORAGE_KEY: 'primarySubtitle',
      SECTION_ID: 'primary-subtitle-section',
      TITLE_MESSAGE_KEY: 'primary_subtitle_section_title',
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
      TITLE_MESSAGE_KEY: 'secondary_subtitle_section_title',
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
  SKIP_TIME: {
    STORAGE_KEY: 'skipTime',
    SECTION_ID: 'skip-time-section',
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
    SECTION_ID: 'sub-key-section',
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

export const INPUT_ID_TO_STORAGE_OPTION_KEY = generateInputToStorageKey(SETTINGS);

function generateInputToStorageKey(settings: typeof SETTINGS) {
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
