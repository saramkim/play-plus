import { z } from 'zod';

import { LANGUAGES, Language } from '@utils/constants';

import {
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
} from '@/listening/domain/source-identity';

import { CONTROL_COMMANDS, navigationProfileSchema } from './control-settings';

export {
  listeningSegmentKeySchema,
  listeningSourceKeySchema,
} from '@/listening/domain/source-identity';

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

export const shortcutBindingSchema = z.object({ key: v2ShortcutSchema, enabled: z.boolean() }).strict();

export const v2ShortcutsSchema = z.object({
  saveCard: shortcutBindingSchema,
  saveLearning: shortcutBindingSchema,
  saveSupport: shortcutBindingSchema,
  copyLearning: shortcutBindingSchema,
  copySupport: shortcutBindingSchema,
  toggleLearning: shortcutBindingSchema,
  toggleSupport: shortcutBindingSchema,
  previousCue: shortcutBindingSchema,
  nextCue: shortcutBindingSchema,
  secondaryPrevious: shortcutBindingSchema,
  secondaryNext: shortcutBindingSchema,
  repeatCurrentCue: shortcutBindingSchema,
  playOnce: shortcutBindingSchema,
  toggleAB: shortcutBindingSchema,
  setA: shortcutBindingSchema,
  setB: shortcutBindingSchema,
  navigation: z.object({ primary: navigationProfileSchema, secondary: navigationProfileSchema }).strict(),
}).strict();

export const v2PlaybackSpeedSchema = z.object({
  increase: shortcutBindingSchema,
  decrease: shortcutBindingSchema,
  reset: shortcutBindingSchema,
}).strict();

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

export const learningCardContentSchema = z.union([
  assignedContentSchema,
  z.object({ support: assignedLineSchema }).strict(),
  unassignedContentSchema,
]);

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

export const listeningVideoIdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const listeningProgressStateSchema = z.enum(['attempted', 'cleared', 'mastered']);

export const nonnegativeSafeIntegerSchema = z
  .number()
  .int()
  .nonnegative()
  .refine(Number.isSafeInteger, { message: 'Expected a nonnegative safe integer' });

export const offsetDateTimeSchema = z.string().datetime({ offset: true });

const listeningProgressItemSchema = z
  .object({
    state: listeningProgressStateSchema,
    totalAttempts: nonnegativeSafeIntegerSchema,
    lastPracticedAt: offsetDateTimeSchema,
  })
  .strict()
  .superRefine(({ state, totalAttempts }, context) => {
    if (state !== 'attempted' && totalAttempts === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cleared or mastered progress requires a submitted attempt',
        path: ['totalAttempts'],
      });
    }
  });

const listeningProgressSourceSchema = z
  .object({
    segmenterVersion: z.literal(1),
    bestCombo: nonnegativeSafeIntegerSchema,
    lastPracticedAt: offsetDateTimeSchema,
    items: z.record(listeningSegmentKeySchema, listeningProgressItemSchema),
  })
  .strict();

const listeningProgressVideoSchema = z
  .object({
    sources: z.record(listeningSourceKeySchema, listeningProgressSourceSchema),
  })
  .strict();

export const listeningProgressSchema = z
  .object({
    version: z.literal(1),
    videos: z.record(listeningVideoIdSchema, listeningProgressVideoSchema),
  })
  .strict();

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

const shortcutFieldSchema = z.enum([...CONTROL_COMMANDS, 'speedIncrease', 'speedDecrease', 'speedReset']);

const shortcutCandidateSourceSchema = z.enum([
  'savePrimary', 'saveSecondary', 'copyPrimary', 'copySecondary', 'togglePrimary', 'toggleSecondary',
  'videoSkip.backward', 'videoSkip.forward', 'subVideoSkip.backward', 'subVideoSkip.forward',
  'loop.loopCurrentSubtitle', 'loop.playCurrentSubtitleOnce', 'loop.toggleLoop', 'loop.startPoint', 'loop.endPoint',
  'playbackSpeed.increase', 'playbackSpeed.decrease', 'playbackSpeed.reset',
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
      ...CONTROL_COMMANDS.map((field) => [`shortcuts.${field}`, shortcuts[field]] as const),
      ...(['increase', 'decrease', 'reset'] as const).map((field) => [`playbackSpeed.${field}`, playbackSpeed[field]] as const),
    ];
    const owners = new Map<string, string>();

    for (const [field, binding] of entries) {
      if (!binding.enabled || !binding.key) continue;
      const shortcut = binding.key;
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
    listeningProgress: listeningProgressSchema,
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
