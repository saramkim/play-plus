import { z } from 'zod';

import { DEFAULT_SUBTITLE_LANGUAGES, Language } from '@utils/constants';
import { t } from '@utils/i18n';

import { SubtitleId } from './subtitle';

const RESERVED_SHORTCUTS = ['ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape', 'KeyF', 'KeyM'];
const shortcutSchema = z
  .string()
  .refine((shortcut) => !RESERVED_SHORTCUTS.includes(shortcut), { message: t('error_reserved_shortcuts') });

const loopConfigSchema = z.object({
  enabled: z.boolean(),
  toggleLoop: shortcutSchema,
  startPoint: shortcutSchema,
  endPoint: shortcutSchema,
  loopCurrentSubtitle: shortcutSchema,
  playCurrentSubtitleOnce: shortcutSchema,
});
const videoSkipConfigSchema = z.object({
  enabled: z.boolean(),
  forward: shortcutSchema,
  backward: shortcutSchema,
  skipTime: z.number(),
  skipTimeUnit: z.enum(['seconds', 'minutes', 'subtitles']),
  fallbackTime: z.number(),
  fallbackUnit: z.enum(['seconds', 'minutes']),
});
const subtitleConfigSchema = z.object({
  enabled: z.boolean(),
  language: z.enum(DEFAULT_SUBTITLE_LANGUAGES),
  positionReference: z.enum(['top', 'center', 'bottom']),
  positionOffset: z.number(),
  color: z.string(),
  fontSize: z.number().min(1).max(10),
  fontWeight: z.number().min(1).max(6),
  backgroundOpacity: z.number().min(0).max(100),
  lineBreak: z.boolean(),
  delay: z.number(),
});
const shortcutsConfigSchema = z.object({
  enabled: z.boolean(),
  savePrimary: shortcutSchema,
  saveSecondary: shortcutSchema,
  togglePrimary: shortcutSchema,
  toggleSecondary: shortcutSchema,
});

const playbackSpeedConfigSchema = z.object({
  enabled: z.boolean(),
  increase: shortcutSchema,
  decrease: shortcutSchema,
  reset: shortcutSchema,
});

export const storageSchema = {
  videoSkip: videoSkipConfigSchema,
  subVideoSkip: videoSkipConfigSchema,
  primarySubtitle: subtitleConfigSchema,
  secondarySubtitle: subtitleConfigSchema,
  shortcuts: shortcutsConfigSchema,
  loop: loopConfigSchema,
  playbackSpeed: playbackSpeedConfigSchema,
};

export const savedSubtitleSchema = z.object({
  content: z.string(),
  url: z.string(),
  startTime: z.number(),
  savedAt: z.string(),
});
export const subtitleMetadataSchema = z.object({
  id: z.custom<SubtitleId>(),
  title: z.string(),
  language: z.custom<Language>(),
  savedAt: z.string(),
});
