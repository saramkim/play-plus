import { z } from 'zod';

import { DEFAULT_SUBTITLE_LANGUAGES, LANGUAGES, Language } from '@utils/constants';

const RESERVED_SHORTCUTS = ['ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape', 'KeyF', 'KeyM'];
const shortcutSchema = z
  .string()
  .refine((shortcut) => !RESERVED_SHORTCUTS.includes(shortcut), { message: 'Reserved shortcut' });

const subtitleConfigSchema = z
  .object({
    enabled: z.boolean(),
    language: z.enum(DEFAULT_SUBTITLE_LANGUAGES),
    positionReference: z.enum(['top', 'center', 'bottom']),
    positionOffset: z.number(),
    color: z.string(),
    fontSize: z.number().min(1).max(10),
    fontWeight: z.number().min(1).max(6),
    backgroundOpacity: z.number().min(0).max(100),
    lineBreak: z.boolean(),
  })
  .strict();

const videoSkipConfigSchema = z
  .object({
    enabled: z.boolean(),
    forward: shortcutSchema,
    backward: shortcutSchema,
    skipTime: z.number(),
    skipTimeUnit: z.enum(['seconds', 'minutes', 'subtitles']),
    fallbackTime: z.number(),
    fallbackUnit: z.enum(['seconds', 'minutes']),
  })
  .strict();

const shortcutsConfigSchema = z
  .object({
    enabled: z.boolean(),
    savePrimary: shortcutSchema,
    saveSecondary: shortcutSchema,
    copyPrimary: shortcutSchema,
    copySecondary: shortcutSchema,
    togglePrimary: shortcutSchema,
    toggleSecondary: shortcutSchema,
  })
  .strict();

const loopConfigSchema = z
  .object({
    enabled: z.boolean(),
    toggleLoop: shortcutSchema,
    startPoint: shortcutSchema,
    endPoint: shortcutSchema,
    loopCurrentSubtitle: shortcutSchema,
    playCurrentSubtitleOnce: shortcutSchema,
  })
  .strict();

const playbackSpeedConfigSchema = z
  .object({
    enabled: z.boolean(),
    increase: shortcutSchema,
    decrease: shortcutSchema,
    reset: shortcutSchema,
  })
  .strict();

export const v1SavedSubtitleSchema = z
  .object({
    content: z.string(),
    url: z.string(),
    startTime: z.number(),
    savedAt: z.string(),
  })
  .strict();

const languageSchema = z.custom<Language>(
  (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, value)
);

export const v1RegisteredSubtitleMetadataSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    language: languageSchema,
    savedAt: z.string(),
    delay: z.number().optional(),
  })
  .strict();

const rawSyncStorageSchema = z
  .object({
    primarySubtitle: z.unknown().optional(),
    secondarySubtitle: z.unknown().optional(),
    videoSkip: z.unknown().optional(),
    subVideoSkip: z.unknown().optional(),
    shortcuts: z.unknown().optional(),
    loop: z.unknown().optional(),
    playbackSpeed: z.unknown().optional(),
  })
  .strict();

const rawLocalStorageSchema = z
  .object({
    savedSubtitles: z.unknown().optional(),
    registeredSubtitles: z.unknown().optional(),
    subtitleBodies: z.record(z.unknown()).optional(),
  })
  .strict();

export const V1_11_SYNC_STORAGE_KEYS = [
  'primarySubtitle',
  'secondarySubtitle',
  'videoSkip',
  'subVideoSkip',
  'shortcuts',
  'loop',
  'playbackSpeed',
] as const;

export const V1_11_LOCAL_STORAGE_KEYS = ['savedSubtitles', 'registeredSubtitles'] as const;

export const V1_11_DEFAULT_SYNC_STORAGE = {
  primarySubtitle: {
    enabled: true,
    language: 'en',
    positionReference: 'bottom',
    positionOffset: 180,
    color: '#ffffff',
    fontSize: 6,
    fontWeight: 4,
    backgroundOpacity: 0,
    lineBreak: true,
  },
  secondarySubtitle: {
    enabled: true,
    language: 'ko',
    positionReference: 'bottom',
    positionOffset: 100,
    color: '#ffffff',
    fontSize: 4,
    fontWeight: 2,
    backgroundOpacity: 0,
    lineBreak: false,
  },
  videoSkip: {
    enabled: true,
    forward: 'ArrowRight',
    backward: 'ArrowLeft',
    skipTime: 1,
    skipTimeUnit: 'subtitles',
    fallbackTime: 5,
    fallbackUnit: 'seconds',
  },
  subVideoSkip: {
    enabled: false,
    forward: '',
    backward: '',
    skipTime: 10,
    skipTimeUnit: 'seconds',
    fallbackTime: 10,
    fallbackUnit: 'seconds',
  },
  shortcuts: {
    enabled: false,
    savePrimary: '',
    saveSecondary: '',
    copyPrimary: '',
    copySecondary: '',
    togglePrimary: '',
    toggleSecondary: '',
  },
  loop: {
    enabled: false,
    toggleLoop: '',
    startPoint: '',
    endPoint: '',
    loopCurrentSubtitle: '',
    playCurrentSubtitleOnce: '',
  },
  playbackSpeed: {
    enabled: false,
    increase: '',
    decrease: '',
    reset: '',
  },
} as const;

const parsePersistedConfig = <T extends z.ZodTypeAny>(schema: T, defaults: z.input<T>, value: unknown) => {
  if (value !== undefined && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    return schema.parse(value);
  }
  return schema.parse({ ...defaults, ...(value ?? {}) });
};

export const parseV1_11SyncStorage = (value: unknown) => {
  const raw = rawSyncStorageSchema.parse(value);
  return {
    primarySubtitle: parsePersistedConfig(
      subtitleConfigSchema,
      V1_11_DEFAULT_SYNC_STORAGE.primarySubtitle,
      raw.primarySubtitle
    ),
    secondarySubtitle: parsePersistedConfig(
      subtitleConfigSchema,
      V1_11_DEFAULT_SYNC_STORAGE.secondarySubtitle,
      raw.secondarySubtitle
    ),
    videoSkip: parsePersistedConfig(videoSkipConfigSchema, V1_11_DEFAULT_SYNC_STORAGE.videoSkip, raw.videoSkip),
    subVideoSkip: parsePersistedConfig(
      videoSkipConfigSchema,
      V1_11_DEFAULT_SYNC_STORAGE.subVideoSkip,
      raw.subVideoSkip
    ),
    shortcuts: parsePersistedConfig(shortcutsConfigSchema, V1_11_DEFAULT_SYNC_STORAGE.shortcuts, raw.shortcuts),
    loop: parsePersistedConfig(loopConfigSchema, V1_11_DEFAULT_SYNC_STORAGE.loop, raw.loop),
    playbackSpeed: parsePersistedConfig(
      playbackSpeedConfigSchema,
      V1_11_DEFAULT_SYNC_STORAGE.playbackSpeed,
      raw.playbackSpeed
    ),
  };
};

export const parseV1_11LocalStorage = (value: unknown) => {
  const raw = rawLocalStorageSchema.parse(value);
  return {
    savedSubtitles: z.array(v1SavedSubtitleSchema).parse(raw.savedSubtitles ?? []),
    registeredSubtitles: z.array(z.unknown()).parse(raw.registeredSubtitles ?? []),
    subtitleBodies: raw.subtitleBodies ?? {},
  };
};

export type V1_11SyncStorage = ReturnType<typeof parseV1_11SyncStorage>;
export type V1_11LocalStorage = ReturnType<typeof parseV1_11LocalStorage>;
export type V1SavedSubtitle = z.infer<typeof v1SavedSubtitleSchema>;
