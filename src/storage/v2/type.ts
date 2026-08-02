import { z } from 'zod';

import {
  learningCardSchema,
  migrationStateSchema,
  registeredSubtitleMetadataSchema,
  shortcutConfirmationSchema,
  subtitleCueSchema,
  unavailableRegisteredSubtitleSchema,
  v2LocalDataSchema,
  v2MarkerSchema,
  v2SyncStorageSchema,
} from './schema';

export type LearningCard = z.infer<typeof learningCardSchema>;
export type V2MigrationState = z.infer<typeof migrationStateSchema>;
export type V2RegisteredSubtitleMetadata = z.infer<typeof registeredSubtitleMetadataSchema>;
export type V2ShortcutConfirmation = z.infer<typeof shortcutConfirmationSchema>;
export type V2SubtitleCue = z.infer<typeof subtitleCueSchema>;
export type V2UnavailableRegisteredSubtitle = z.infer<typeof unavailableRegisteredSubtitleSchema>;
export type V2LocalData = z.infer<typeof v2LocalDataSchema>;
export type V2Marker = z.infer<typeof v2MarkerSchema>;
export type V2SyncStorage = z.infer<typeof v2SyncStorageSchema>;
