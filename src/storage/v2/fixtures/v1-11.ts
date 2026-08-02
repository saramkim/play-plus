const FIRST_SUBTITLE_ID = 'subtitle-11111111-1111-4111-8111-111111111111';
const SECOND_SUBTITLE_ID = 'subtitle-22222222-2222-4222-8222-222222222222';

// Synthetic user values shaped exclusively from the remote v1.11.0 release tag (70cf326).
export const createV1_11Fixture = () => ({
  sync: {
    primarySubtitle: {
      enabled: true,
      language: 'en',
      positionReference: 'center',
      positionOffset: 42,
      color: '#123456',
      fontSize: 9,
      fontWeight: 5,
      backgroundOpacity: 35,
      lineBreak: false,
    },
    secondarySubtitle: {
      enabled: false,
      language: 'ko',
      positionReference: 'top',
      positionOffset: -12,
      color: '#abcdef',
      fontSize: 3,
      fontWeight: 2,
      backgroundOpacity: 80,
      lineBreak: true,
    },
    videoSkip: {
      enabled: true,
      forward: 'KeyD',
      backward: 'KeyA',
      skipTime: 1,
      skipTimeUnit: 'subtitles',
      fallbackTime: 5,
      fallbackUnit: 'seconds',
    },
    subVideoSkip: {
      enabled: true,
      forward: 'KeyX',
      backward: 'KeyZ',
      skipTime: 10,
      skipTimeUnit: 'seconds',
      fallbackTime: 10,
      fallbackUnit: 'seconds',
    },
    shortcuts: {
      enabled: true,
      savePrimary: 'KeyS',
      saveSecondary: '',
      copyPrimary: 'KeyC',
      copySecondary: 'KeyV',
      togglePrimary: 'KeyP',
      toggleSecondary: 'KeyO',
    },
    loop: {
      enabled: true,
      toggleLoop: 'KeyL',
      startPoint: 'BracketLeft',
      endPoint: 'BracketRight',
      loopCurrentSubtitle: 'KeyR',
      playCurrentSubtitleOnce: 'KeyT',
    },
    playbackSpeed: {
      enabled: true,
      increase: 'Equal',
      decrease: 'Minus',
      reset: 'Digit0',
    },
  },
  local: {
    savedSubtitles: [
      {
        content: 'Keep duplicate',
        url: 'https://www.coupangplay.com/play/example',
        startTime: 12.5,
        savedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        content: 'Keep duplicate',
        url: 'https://www.coupangplay.com/play/example',
        startTime: 12.5,
        savedAt: '2026-07-01T00:00:00.000Z',
      },
      {
        content: '두 번째 문장',
        url: 'https://www.coupangplay.com/play/example',
        startTime: 30,
        savedAt: '2026-07-01T00:01:00.000Z',
      },
    ],
    registeredSubtitles: [
      {
        id: FIRST_SUBTITLE_ID,
        title: 'English local file',
        language: 'en',
        savedAt: '2026-07-01T00:02:00.000Z',
      },
      {
        id: SECOND_SUBTITLE_ID,
        title: 'Korean local file',
        language: 'ko',
        savedAt: '2026-07-01T00:03:00.000Z',
        delay: 0.35,
      },
    ],
    subtitleBodies: {
      [FIRST_SUBTITLE_ID]: [
        { start: 10, end: 12, text: 'First cue' },
        { start: 12, end: 14, text: 'Second cue', settings: ['line:80%'] },
      ],
      [SECOND_SUBTITLE_ID]: [{ start: 10.1, end: 14.1, text: '첫 번째와 두 번째 자막' }],
    },
  },
});
