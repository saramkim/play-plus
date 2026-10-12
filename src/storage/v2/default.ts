import { ListeningProgressV1, V2LocalData, V2SyncStorage } from './type';

export const createDefaultListeningProgress = (): ListeningProgressV1 => ({
  version: 1,
  videos: {},
});

export const DEFAULT_V2_SYNC_STORAGE: V2SyncStorage = {
  learningProfile: {
    learningLanguage: 'en',
    supportLanguage: 'ko',
  },
  subtitleDisplay: {
    learning: {
      visibility: 'visible',
      appearance: {
        positionReference: 'bottom',
        positionOffset: 180,
        color: '#ffffff',
        fontSize: 6,
        fontWeight: 4,
        backgroundOpacity: 0,
        lineBreak: true,
      },
    },
    support: {
      visibility: 'visible',
      appearance: {
        positionReference: 'bottom',
        positionOffset: 100,
        color: '#ffffff',
        fontSize: 4,
        fontWeight: 2,
        backgroundOpacity: 0,
        lineBreak: false,
      },
    },
  },
  shortcuts: {
    saveCard: { enabled: false, key: '' },
    saveLearning: { enabled: false, key: '' },
    saveSupport: { enabled: false, key: '' },
    copyLearning: { enabled: false, key: '' },
    copySupport: { enabled: false, key: '' },
    toggleLearning: { enabled: false, key: '' },
    toggleSupport: { enabled: false, key: '' },
    previousCue: { enabled: false, key: 'ArrowLeft' },
    nextCue: { enabled: false, key: 'ArrowRight' },
    secondaryPrevious: { enabled: false, key: '' },
    secondaryNext: { enabled: false, key: '' },
    repeatCurrentCue: { enabled: false, key: '' },
    playOnce: { enabled: false, key: '' },
    toggleAB: { enabled: false, key: '' },
    setA: { enabled: false, key: '' },
    setB: { enabled: false, key: '' },
    navigation: {
      primary: { amount: 1, unit: 'subtitles', fallbackEnabled: false, fallbackAmount: 5, fallbackUnit: 'seconds' },
      secondary: { amount: 10, unit: 'seconds', fallbackEnabled: false, fallbackAmount: 5, fallbackUnit: 'seconds' },
    },
  },
  playbackSpeed: {
    increase: { enabled: false, key: '' },
    decrease: { enabled: false, key: '' },
    reset: { enabled: false, key: '' },
  },
};

export const createDefaultV2LocalData = (): V2LocalData => ({
  learningCards: [],
  listeningProgress: createDefaultListeningProgress(),
  registeredSubtitles: [],
  subtitleBodies: {},
  migrationState: {
    status: 'prepared',
    sourceVersion: null,
    shortcutConfirmations: [],
    unavailableRegisteredSubtitles: [],
  },
});
