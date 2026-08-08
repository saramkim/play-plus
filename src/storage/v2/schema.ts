import { z } from 'zod';

import { LANGUAGES, Language } from '@utils/constants';

export const V2_RESERVED_SHORTCUTS = [
  'ArrowUp',
  'ArrowDown',
  'Enter',
  'Space',
  'Escape',
  'KeyF',
  'KeyM',
] as const;

const reservedShortcutSet = new Set<string>(V2_RESERVED_SHORTCUTS);

export const isReservedV2Shortcut = (shortcut: string) => reservedShortcutSet.has(shortcut);

export const languageSchema = z.custom<Language>(
  (value) => typeof value === 'string' && Object.prototype.hasOwnProperty.call(LANGUAGES, value)
);

export const v2ShortcutSchema = z
  .string()
  .refine((shortcut) => !isReservedV2Shortcut(shortcut), { message: 'Reserved shortcut' });

export const subtitleAppearanceSchema = z
  .object({
    positionReference: z.enum(['top', 'center', 'bottom']),
    positionOffset: z.number(),
    color: z.string(),
    fontSize: z.number().min(1).max(10),
    fontWeight: z.number().min(1).max(6),
    backgroundOpacity: z.number().min(0).max(100),
    lineBreak: z.boolean(),
  })
  .strict();

const subtitleRoleDisplaySchema = z
  .object({
    visibility: z.enum(['visible', 'hidden']),
    appearance: subtitleAppearanceSchema,
  })
  .strict();

export const learningProfileSchema = z
  .object({
    learningLanguage: languageSchema,
    supportLanguage: languageSchema.nullable(),
  })
  .strict();

export const subtitleDisplaySchema = z
  .object({
    learning: subtitleRoleDisplaySchema,
    support: subtitleRoleDisplaySchema,
  })
  .strict();

export const v2ShortcutsSchema = z
  .object({
    enabled: z.boolean(),
    saveCard: v2ShortcutSchema,
    previousCue: v2ShortcutSchema,
    nextCue: v2ShortcutSchema,
    repeatCurrentCue: v2ShortcutSchema,
  })
  .strict();

export const v2PlaybackSpeedSchema = z
  .object({
    enabled: z.boolean(),
    increase: v2ShortcutSchema,
    decrease: v2ShortcutSchema,
    reset: v2ShortcutSchema,
  })
  .strict();

const assignedLineSchema = z
  .object({
    text: z.string().min(1),
    language: languageSchema,
  })
  .strict();

const unassignedLineSchema = z
  .object({
    text: z.string().min(1),
    language: z.literal('und'),
  })
  .strict();

const assignedContentSchema = z
  .object({
    learning: assignedLineSchema,
    support: assignedLineSchema.optional(),
  })
  .strict();

const unassignedContentSchema = z.object({ unassigned: unassignedLineSchema }).strict();

export const learningCardContentSchema = z.union([assignedContentSchema, unassignedContentSchema]);

const learningCardSourceSchema = z
  .object({
    url: z.string(),
    startTime: z.number(),
    endTime: z.number().optional(),
    title: z.string().optional(),
  })
  .strict()
  .superRefine(({ endTime, startTime }, context) => {
    if (endTime !== undefined && endTime < startTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endTime must be greater than or equal to startTime',
        path: ['endTime'],
      });
    }
  });

export const learningCardSchema = z
  .object({
    id: z.string().regex(/^card-(?:v1-[0-9a-f]{64}|[0-9a-z-]+)$/),
    content: learningCardContentSchema,
    source: learningCardSourceSchema,
    studyState: z.enum(['active', 'completed']),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const registeredSubtitleIdSchema = z
  .string()
  .regex(/^subtitle-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const registeredSubtitleMetadataSchema = z
  .object({
    id: registeredSubtitleIdSchema,
    title: z.string(),
    language: languageSchema,
    savedAt: z.string(),
    delay: z.number().optional(),
  })
  .strict();

export const subtitleCueSchema = z
  .object({
    start: z.number(),
    end: z.number(),
    text: z.string(),
    settings: z.array(z.string()).optional(),
  })
  .strict()
  .refine(({ end, start }) => end >= start, { message: 'Cue end must be greater than or equal to start' });

const shortcutFieldSchema = z.enum([
  'saveCard',
  'previousCue',
  'nextCue',
  'repeatCurrentCue',
  'speedIncrease',
  'speedDecrease',
  'speedReset',
]);

const shortcutCandidateSourceSchema = z.enum([
  'savePrimary',
  'saveSecondary',
  'videoSkip.backward',
  'videoSkip.forward',
  'loop.loopCurrentSubtitle',
  'playbackSpeed.increase',
  'playbackSpeed.decrease',
  'playbackSpeed.reset',
]);

const shortcutCandidateSchema = z
  .object({
    source: shortcutCandidateSourceSchema,
    shortcut: v2ShortcutSchema,
  })
  .strict();

export const shortcutConfirmationSchema = z
  .object({
    field: shortcutFieldSchema,
    candidates: z.array(shortcutCandidateSchema).min(1),
    reason: z.enum(['multiple-candidates', 'ambiguous-semantics', 'conflict']),
    conflictingFields: z.array(shortcutFieldSchema).optional(),
  })
  .strict();

export const unavailableRegisteredSubtitleSchema = z
  .object({
    reason: z.enum(['invalid-metadata', 'missing-body', 'invalid-body', 'orphan-body']),
    originalIndex: z.number().int().nonnegative().optional(),
    id: registeredSubtitleIdSchema.optional(),
    bodyKey: z.string().optional(),
    rawMetadata: z.unknown().optional(),
  })
  .strict();

export const migrationStateSchema = z
  .object({
    status: z.enum(['prepared', 'writing', 'validating', 'cleanup-pending', 'complete']),
    sourceVersion: z.literal('1.11.0').nullable(),
    shortcutConfirmations: z.array(shortcutConfirmationSchema),
    unavailableRegisteredSubtitles: z.array(unavailableRegisteredSubtitleSchema),
  })
  .strict();

const subtitleBodiesSchema = z.record(z.array(subtitleCueSchema)).superRefine((bodies, context) => {
  for (const id of Object.keys(bodies)) {
    if (!registeredSubtitleIdSchema.safeParse(id).success) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid subtitle body id', path: [id] });
    }
  }
});

export const v2SyncStorageSchema = z
  .object({
    learningProfile: learningProfileSchema,
    subtitleDisplay: subtitleDisplaySchema,
    shortcuts: v2ShortcutsSchema,
    playbackSpeed: v2PlaybackSpeedSchema,
  })
  .strict()
  .superRefine(({ playbackSpeed, shortcuts }, context) => {
    const entries = [
      ['shortcuts.saveCard', shortcuts.saveCard],
      ['shortcuts.previousCue', shortcuts.previousCue],
      ['shortcuts.nextCue', shortcuts.nextCue],
      ['shortcuts.repeatCurrentCue', shortcuts.repeatCurrentCue],
      ['playbackSpeed.increase', playbackSpeed.increase],
      ['playbackSpeed.decrease', playbackSpeed.decrease],
      ['playbackSpeed.reset', playbackSpeed.reset],
    ] as const;
    const owners = new Map<string, string>();

    for (const [field, shortcut] of entries) {
      if (!shortcut) continue;
      const owner = owners.get(shortcut);
      if (owner) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Shortcut conflicts with ${owner}`,
          path: field.split('.'),
        });
      } else {
        owners.set(shortcut, field);
      }
    }
  });

export const v2LocalDataSchema = z
  .object({
    learningCards: z.array(learningCardSchema),
    registeredSubtitles: z.array(registeredSubtitleMetadataSchema),
    subtitleBodies: subtitleBodiesSchema,
    migrationState: migrationStateSchema,
  })
  .strict();

export const dataSchemaVersionSchema = z.literal(2);

export const v2MarkerSchema = z
  .object({
    dataSchemaVersion: dataSchemaVersionSchema,
    migrationState: migrationStateSchema.refine(
      ({ status }) => status === 'cleanup-pending' || status === 'complete',
      { message: 'A v2 marker requires cleanup-pending or complete migration state' }
    ),
  })
  .strict();
