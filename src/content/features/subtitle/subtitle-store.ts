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

type SubtitleSettings = Pick<V2SyncStorage, 'learningProfile' | 'subtitleDisplay'>;

export interface SubtitleStoreState extends SubtitleSettings {
  nativeCueCache: Partial<Record<Language, V2SubtitleCue[]>>;
  registeredSelections: Record<SubtitleRole, RegisteredSubtitleSelection | null>;
  subtitleRevision: number;

  setSettings: (settings: SubtitleSettings) => void;
  setNativeCues: (language: Language, cues: V2SubtitleCue[]) => void;
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
    set((state) => ({
      nativeCueCache: { ...state.nativeCueCache, [parsedLanguage]: parsedCues },
      subtitleRevision: state.subtitleRevision + 1,
    }));
  },
  clearNativeCues: (language) => {
    if (language === undefined) {
      set((state) => ({
        nativeCueCache: {},
        subtitleRevision: state.subtitleRevision + 1,
      }));
      return;
    }

    const parsedLanguage = languageSchema.parse(language);
    set((state) => {
      const { [parsedLanguage]: _, ...nativeCueCache } = state.nativeCueCache;
      return {
        nativeCueCache,
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
      registeredSelections: createEmptyRegisteredSelections(),
      subtitleRevision: state.subtitleRevision + 1,
    })),
}));
