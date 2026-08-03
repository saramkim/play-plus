export const COUPANG_PLAY_BASE_URL = 'https://www.coupangplay.com';
export const COUPANG_PLAY_VIDEO_URL_LIST = [
  `${COUPANG_PLAY_BASE_URL}/play`,
  `${COUPANG_PLAY_BASE_URL}/en/play`,
];
export const COUPANG_PLAY_SUBTITLE_API_URL = `${COUPANG_PLAY_BASE_URL}/api/playback/play`;
export const COUPANG_PLAY_SELECTORS = {
  player: '#playerWrapper',
  mainVideo: 'video[data-cy="main-video"]',
  progressBar: 'div.slider',
  advertisement: '[class*="AdOverlay_"]',
} as const;

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

export const REGISTRATION = {
  STORAGE_KEY: 'registeredSubtitles',
  ID_PREFIX: 'subtitle',
} as const;
