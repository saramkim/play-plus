import { z } from 'zod';

import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import {
  languageSchema,
  learningProfileSchema,
  registeredSubtitleIdSchema,
  subtitleCueSchema,
  subtitleDisplaySchema,
} from '@storage/v2/schema';
import { V2RegisteredSubtitleMetadata, V2SubtitleCue, V2SyncStorage } from '@storage/v2/type';
import { Language } from '@utils/constants';
import { create } from 'zustand';

export const SUBTITLE_ROLES = ['learning', 'support'] as const;
export type SubtitleRole = (typeof SUBTITLE_ROLES)[number];

const subtitleRoleSchema = z.enum(SUBTITLE_ROLES);
const registeredSubtitleSelectionSchema = z
  .object({
    subtitleId: registeredSubtitleIdSchema,
    cues: z.array(subtitleCueSchema),
    delay: z.number().finite(),
  })
  .strict();

export interface RegisteredSubtitleSelection {
  subtitleId: V2RegisteredSubtitleMetadata['id'];
  cues: V2SubtitleCue[];
  delay: number;
}

export interface ResolvedSubtitleTrack {
  cues: V2SubtitleCue[];
  delay: number;
}

export type NativeSubtitleCategory = 'regular' | 'sdh';

export interface NativeSubtitleTrack {
  category: NativeSubtitleCategory;
  cues: V2SubtitleCue[];
  language: Language;
  physicalIdentity: string;
}

export interface NativeSubtitleTrackIdentity {
  category: NativeSubtitleCategory;
  physicalIdentity: string;
}

type SubtitleSettings = Pick<V2SyncStorage, 'learningProfile' | 'subtitleDisplay'>;

export interface SubtitleStoreState extends SubtitleSettings {
  nativeCueCache: Partial<Record<Language, V2SubtitleCue[]>>;
  nativeTrackIdentityCache: Partial<Record<Language, NativeSubtitleTrackIdentity>>;
  registeredSelections: Record<SubtitleRole, RegisteredSubtitleSelection | null>;
  subtitleRevision: number;

  setSettings: (settings: SubtitleSettings) => void;
  setNativeCues: (language: Language, cues: V2SubtitleCue[]) => void;
  applyNativeSubtitleSnapshot: (tracks: readonly NativeSubtitleTrack[]) => boolean;
  clearNativeCues: (language?: Language) => void;
  setRegisteredSelection: (role: SubtitleRole, selection: RegisteredSubtitleSelection) => void;
  clearRegisteredSelection: (role: SubtitleRole) => void;
  clearCaches: () => void;
}

const createEmptyRegisteredSelections = (): SubtitleStoreState['registeredSelections'] => ({
  learning: null,
  support: null,
});

const initialSettings: SubtitleSettings = {
  learningProfile: learningProfileSchema.parse(DEFAULT_V2_SYNC_STORAGE.learningProfile),
  subtitleDisplay: subtitleDisplaySchema.parse(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay),
};

const nativeSubtitleTrackSchema = z
  .object({
    category: z.enum(['regular', 'sdh']),
    cues: z.array(subtitleCueSchema),
    language: languageSchema,
    physicalIdentity: z.string().min(1),
  })
  .strict();

const areSubtitleCuesEqual = (left: V2SubtitleCue, right: V2SubtitleCue) =>
  left.start === right.start &&
  left.end === right.end &&
  left.text === right.text &&
  (left.settings?.length ?? 0) === (right.settings?.length ?? 0) &&
  (left.settings ?? []).every((setting, index) => setting === right.settings?.[index]);

const areNativeSubtitleSnapshotsEqual = (
  state: Pick<SubtitleStoreState, 'nativeCueCache' | 'nativeTrackIdentityCache'>,
  cues: SubtitleStoreState['nativeCueCache'],
  identities: SubtitleStoreState['nativeTrackIdentityCache']
) => {
  const languages = Object.keys(state.nativeCueCache) as Language[];
  if (languages.length !== Object.keys(cues).length) return false;
  return languages.every((language) => {
    const currentCues = state.nativeCueCache[language];
    const nextCues = cues[language];
    const currentIdentity = state.nativeTrackIdentityCache[language];
    const nextIdentity = identities[language];
    return (
      currentCues !== undefined &&
      nextCues !== undefined &&
      currentIdentity !== undefined &&
      nextIdentity !== undefined &&
      currentIdentity.category === nextIdentity.category &&
      currentIdentity.physicalIdentity === nextIdentity.physicalIdentity &&
      currentCues.length === nextCues.length &&
      currentCues.every((cue, index) => areSubtitleCuesEqual(cue, nextCues[index]))
    );
  });
};

export const selectSubtitleTrack = (
  state: Pick<SubtitleStoreState, 'learningProfile' | 'nativeCueCache' | 'registeredSelections'>,
  role: SubtitleRole
): ResolvedSubtitleTrack => {
  const language = role === 'learning' ? state.learningProfile.learningLanguage : state.learningProfile.supportLanguage;

  if (language === null) return { cues: [], delay: 0 };

  const registeredSelection = state.registeredSelections[role];
  if (registeredSelection) {
    return { cues: registeredSelection.cues, delay: registeredSelection.delay };
  }

  return { cues: state.nativeCueCache[language] ?? [], delay: 0 };
};

export const useSubtitleStore = create<SubtitleStoreState>((set) => ({
  ...initialSettings,
  nativeCueCache: {},
  nativeTrackIdentityCache: {},
  registeredSelections: createEmptyRegisteredSelections(),
  subtitleRevision: 0,

  setSettings: ({ learningProfile, subtitleDisplay }) => {
    const settings = {
      learningProfile: learningProfileSchema.parse(learningProfile),
      subtitleDisplay: subtitleDisplaySchema.parse(subtitleDisplay),
    };
    set((state) => ({
      ...settings,
      subtitleRevision: state.subtitleRevision + 1,
    }));
  },
  setNativeCues: (language, cues) => {
    const parsedLanguage = languageSchema.parse(language);
    const parsedCues = z.array(subtitleCueSchema).parse(cues);
    set((state) => {
      const { [parsedLanguage]: _, ...nativeTrackIdentityCache } = state.nativeTrackIdentityCache;
      return {
        nativeCueCache: { ...state.nativeCueCache, [parsedLanguage]: parsedCues },
        nativeTrackIdentityCache,
        subtitleRevision: state.subtitleRevision + 1,
      };
    });
  },
  applyNativeSubtitleSnapshot: (tracks) => {
    const parsedTracks = z.array(nativeSubtitleTrackSchema).parse(tracks);
    const nativeCueCache: SubtitleStoreState['nativeCueCache'] = {};
    const nativeTrackIdentityCache: SubtitleStoreState['nativeTrackIdentityCache'] = {};
    for (const { category, cues, language, physicalIdentity } of parsedTracks) {
      if (nativeCueCache[language] !== undefined) {
        throw new Error('Duplicate native subtitle language');
      }
      nativeCueCache[language] = cues;
      nativeTrackIdentityCache[language] = { category, physicalIdentity };
    }

    let changed = false;
    set((state) => {
      if (areNativeSubtitleSnapshotsEqual(state, nativeCueCache, nativeTrackIdentityCache)) return state;
      changed = true;
      return {
        nativeCueCache,
        nativeTrackIdentityCache,
        subtitleRevision: state.subtitleRevision + 1,
      };
    });
    return changed;
  },
  clearNativeCues: (language) => {
    if (language === undefined) {
      set((state) => ({
        nativeCueCache: {},
        nativeTrackIdentityCache: {},
        subtitleRevision: state.subtitleRevision + 1,
      }));
      return;
    }

    const parsedLanguage = languageSchema.parse(language);
    set((state) => {
      const { [parsedLanguage]: _, ...nativeCueCache } = state.nativeCueCache;
      const { [parsedLanguage]: __, ...nativeTrackIdentityCache } = state.nativeTrackIdentityCache;
      return {
        nativeCueCache,
        nativeTrackIdentityCache,
        subtitleRevision: state.subtitleRevision + 1,
      };
    });
  },
  setRegisteredSelection: (role, selection) => {
    const parsedRole = subtitleRoleSchema.parse(role);
    const parsedSelection = registeredSubtitleSelectionSchema.parse(selection);
    set((state) => ({
      registeredSelections: { ...state.registeredSelections, [parsedRole]: parsedSelection },
      subtitleRevision: state.subtitleRevision + 1,
    }));
  },
  clearRegisteredSelection: (role) => {
    const parsedRole = subtitleRoleSchema.parse(role);
    set((state) => ({
      registeredSelections: { ...state.registeredSelections, [parsedRole]: null },
      subtitleRevision: state.subtitleRevision + 1,
    }));
  },
  clearCaches: () =>
    set((state) => ({
      nativeCueCache: {},
      nativeTrackIdentityCache: {},
      registeredSelections: createEmptyRegisteredSelections(),
      subtitleRevision: state.subtitleRevision + 1,
    })),
}));
