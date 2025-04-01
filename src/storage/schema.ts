import { z } from 'zod';

import { Language } from '@utils/constants';

import { SubtitleId } from './subtitle';

const loopConfigSchema = z.object({
  enabled: z.boolean(),
  toggleLoop: z.string(),
  startPoint: z.string(),
  endPoint: z.string(),
  loopCurrentSubtitle: z.string(),
});
const videoSkipConfigSchema = z.object({
  enabled: z.boolean(),
  forward: z.string(),
  backward: z.string(),
  skipTime: z.number(),
  skipTimeUnit: z.enum(['seconds', 'minutes', 'subtitles']),
  fallbackTime: z.number(),
  fallbackUnit: z.enum(['seconds', 'minutes']),
});
const subtitleConfigSchema = z.object({
  enabled: z.boolean(),
  language: z.enum(['en', 'ko']),
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
  savePrimary: z.string(),
  saveSecondary: z.string(),
  togglePrimary: z.string(),
  toggleSecondary: z.string(),
});
export const storageSchema = {
  videoSkip: videoSkipConfigSchema,
  subVideoSkip: videoSkipConfigSchema,
  primarySubtitle: subtitleConfigSchema,
  secondarySubtitle: subtitleConfigSchema,
  shortcuts: shortcutsConfigSchema,
  loop: loopConfigSchema,
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
