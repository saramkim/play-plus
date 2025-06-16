export const DEFAULT_SUBTITLE_LANGUAGES = ['en', 'ko'] as const;
export type DefaultSubtitleLanguage = (typeof DEFAULT_SUBTITLE_LANGUAGES)[number];

export const LANGUAGES = {
  en: 'english',
  ko: 'korean',
  ja: 'japanese',
  'zh-CN': 'chinese_simplified',
  'zh-TW': 'chinese_traditional',
  es: 'spanish',
  fr: 'french',
  de: 'german',
  pt: 'portuguese',
  ru: 'russian',
  ar: 'arabic',
} as const;
export type Language = keyof typeof LANGUAGES;

export const ENCODING_MAP = {
  UTF_8: 'utf-8',
  EUC_KR: 'euc-kr',
  SHIFT_JIS: 'shift-jis',
  GB18030: 'gb18030',
  BIG5: 'big5',
  WINDOWS_1251: 'windows-1251',
  WINDOWS_1256: 'windows-1256',
} as const;

export const LANGUAGE_ENCODING_MAP: Record<Language, string> = {
  en: ENCODING_MAP.UTF_8,
  ko: ENCODING_MAP.EUC_KR,
  ja: ENCODING_MAP.SHIFT_JIS,
  'zh-CN': ENCODING_MAP.GB18030,
  'zh-TW': ENCODING_MAP.BIG5,
  es: ENCODING_MAP.UTF_8,
  fr: ENCODING_MAP.UTF_8,
  de: ENCODING_MAP.UTF_8,
  pt: ENCODING_MAP.UTF_8,
  ru: ENCODING_MAP.WINDOWS_1251,
  ar: ENCODING_MAP.WINDOWS_1256,
} as const;

export const PAGE_NAME = {
  SUBTITLE_SETTING: 'subtitle-setting',
  VIDEO_SETTING: 'video-setting',
  REVIEW: 'review',
  SUBTITLE_ANALYSIS: 'subtitle-analysis',
  SUBTITLE_REGISTRATION: 'subtitle-registration',
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
  },
  LOOP: {
    STORAGE_KEY: 'loop',
  },
  PLAYBACK_SPEED: {
    STORAGE_KEY: 'playbackSpeed',
  },
} as const;
export type SubtitleSettingStorageKey = (typeof SETTINGS.SUBTITLES)[keyof typeof SETTINGS.SUBTITLES]['STORAGE_KEY'];

export const SET_SUBTITLE_ACTION = {
  SET_PRIMARY: 'setPrimarySubtitle',
  SET_SECONDARY: 'setSecondarySubtitle',
} as const;
export type SetSubtitleAction = (typeof SET_SUBTITLE_ACTION)[keyof typeof SET_SUBTITLE_ACTION];

export const SET_SUBTITLE_STORAGE_KEY_MAP = {
  [SET_SUBTITLE_ACTION.SET_PRIMARY]: SETTINGS.SUBTITLES.PRIMARY.STORAGE_KEY,
  [SET_SUBTITLE_ACTION.SET_SECONDARY]: SETTINGS.SUBTITLES.SECONDARY.STORAGE_KEY,
} as const;

export const REVIEW = {
  STORAGE_KEY: 'savedSubtitles',
  DATA_ATTRIBUTE: {
    START_TIME: 'startTime',
  },
} as const;

export const MORE_MENU_OPTIONS = {
  RESET_SETTINGS: 'resetSettings',
  SET_LEARNING_CONFIG: 'setLearningConfig',
} as const;

export const REGISTRATION = {
  STORAGE_KEY: 'registeredSubtitles',
  ID_PREFIX: 'subtitle',
} as const;
