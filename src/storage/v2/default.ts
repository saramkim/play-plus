import { V2LocalData, V2SyncStorage } from './type';

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
    enabled: false,
    saveCard: '',
    previousCue: 'ArrowLeft',
    nextCue: 'ArrowRight',
    repeatCurrentCue: '',
  },
  playbackSpeed: {
    enabled: false,
    increase: '',
    decrease: '',
    reset: '',
  },
};

export const createDefaultV2LocalData = (): V2LocalData => ({
  learningCards: [],
  registeredSubtitles: [],
  subtitleBodies: {},
  migrationState: {
    status: 'prepared',
    sourceVersion: null,
    shortcutConfirmations: [],
    unavailableRegisteredSubtitles: [],
  },
});
