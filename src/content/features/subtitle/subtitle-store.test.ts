import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  NativeSubtitleTrack,
  RegisteredSubtitleSelection,
  selectSubtitleTrack,
  useSubtitleStore,
} from './subtitle-store';

const registeredSelection: RegisteredSubtitleSelection = {
  subtitleId: 'subtitle-00000000-0000-4000-8000-000000000001',
  cues: [{ start: 10, end: 11, text: 'Registered' }],
  delay: 2,
};

const nativeTrack = (
  language: NativeSubtitleTrack['language'],
  physicalIdentity: string,
  overrides: Partial<NativeSubtitleTrack> = {}
): NativeSubtitleTrack => ({
  category: 'regular',
  cues: [{ start: 1, end: 2, text: language }],
  language,
  physicalIdentity,
  ...overrides,
});

describe('canonical subtitle store', () => {
  beforeEach(() => {
    const store = useSubtitleStore.getState();
    store.clearCaches();
    store.setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
  });

  it('resolves native cues by the canonical language assigned to each role', () => {
    const store = useSubtitleStore.getState();
    const learningCues = [{ start: 1, end: 2, text: 'Learning' }];
    const supportCues = [{ start: 1, end: 2, text: 'Support' }];
    store.setNativeCues('en', learningCues);
    store.setNativeCues('ko', supportCues);

    expect(selectSubtitleTrack(useSubtitleStore.getState(), 'learning')).toEqual({ cues: learningCues, delay: 0 });
    expect(selectSubtitleTrack(useSubtitleStore.getState(), 'support')).toEqual({ cues: supportCues, delay: 0 });
  });

  it('prefers a registered role selection and keeps its delay with the raw cues', () => {
    const store = useSubtitleStore.getState();
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Native' }]);
    store.setRegisteredSelection('learning', registeredSelection);

    expect(selectSubtitleTrack(useSubtitleStore.getState(), 'learning')).toEqual({
      cues: registeredSelection.cues,
      delay: 2,
    });
  });

  it('returns an empty support track when support language is disabled', () => {
    const store = useSubtitleStore.getState();
    store.setRegisteredSelection('support', registeredSelection);
    store.setSettings({
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
    });

    expect(selectSubtitleTrack(useSubtitleStore.getState(), 'support')).toEqual({ cues: [], delay: 0 });
  });

  it('strictly validates settings, native cues, and registered selections', () => {
    const store = useSubtitleStore.getState();

    expect(() =>
      store.setSettings({
        learningProfile: { learningLanguage: 'en' } as never,
        subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
      })
    ).toThrow();
    expect(() => store.setNativeCues('en', [{ start: 2, end: 1, text: 'Invalid' }])).toThrow();
    expect(() =>
      store.setRegisteredSelection('learning', { ...registeredSelection, subtitleId: 'legacy-id' })
    ).toThrow();
    expect(() => store.setRegisteredSelection('primary' as never, registeredSelection)).toThrow();
  });

  it('clears individual native data or all presentation caches', () => {
    const store = useSubtitleStore.getState();
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Native' }]);
    store.setRegisteredSelection('learning', registeredSelection);

    store.clearNativeCues('en');
    expect(selectSubtitleTrack(useSubtitleStore.getState(), 'learning')).toEqual({
      cues: registeredSelection.cues,
      delay: 2,
    });

    store.clearRegisteredSelection('learning');
    expect(selectSubtitleTrack(useSubtitleStore.getState(), 'learning')).toEqual({ cues: [], delay: 0 });

    store.setRegisteredSelection('learning', registeredSelection);
    store.clearCaches();
    expect(useSubtitleStore.getState().nativeCueCache).toEqual({});
    expect(useSubtitleStore.getState().nativeTrackIdentityCache).toEqual({});
    expect(useSubtitleStore.getState().registeredSelections).toEqual({ learning: null, support: null });
  });

  it('applies a complete native snapshot in one revision and ignores an identical reordered replay', () => {
    const store = useSubtitleStore.getState();
    const initialRevision = store.subtitleRevision;
    let revisionTransitions = 0;
    const unsubscribe = useSubtitleStore.subscribe((state, previousState) => {
      if (state.subtitleRevision !== previousState.subtitleRevision) revisionTransitions += 1;
    });
    const english = nativeTrack('en', 'https://synthetic.test/en.vtt');
    const korean = nativeTrack('ko', 'https://synthetic.test/ko.vtt', { category: 'sdh' });

    expect(store.applyNativeSubtitleSnapshot([english, korean])).toBe(true);
    expect(useSubtitleStore.getState()).toMatchObject({
      nativeCueCache: { en: english.cues, ko: korean.cues },
      nativeTrackIdentityCache: {
        en: { category: 'regular', physicalIdentity: english.physicalIdentity },
        ko: { category: 'sdh', physicalIdentity: korean.physicalIdentity },
      },
      subtitleRevision: initialRevision + 1,
    });
    expect(revisionTransitions).toBe(1);

    expect(useSubtitleStore.getState().applyNativeSubtitleSnapshot([korean, english])).toBe(false);
    expect(useSubtitleStore.getState().subtitleRevision).toBe(initialRevision + 1);
    expect(revisionTransitions).toBe(1);
    unsubscribe();
  });

  it.each([
    ['physical identity', { physicalIdentity: 'https://synthetic.test/replacement.vtt' }],
    ['physical category', { category: 'sdh' as const }],
    ['cue snapshot', { cues: [{ start: 2, end: 3, text: 'Changed' }] }],
  ])('revises once for a changed %s', (_name, change) => {
    const store = useSubtitleStore.getState();
    const current = nativeTrack('en', 'https://synthetic.test/en.vtt');
    store.applyNativeSubtitleSnapshot([current]);
    const revision = useSubtitleStore.getState().subtitleRevision;

    expect(
      useSubtitleStore.getState().applyNativeSubtitleSnapshot([{ ...current, ...change }])
    ).toBe(true);
    expect(useSubtitleStore.getState().subtitleRevision).toBe(revision + 1);
  });

  it('rejects duplicate languages without changing the current snapshot', () => {
    const first = nativeTrack('en', 'https://synthetic.test/first.vtt');
    const second = nativeTrack('en', 'https://synthetic.test/second.vtt');
    const store = useSubtitleStore.getState();
    store.applyNativeSubtitleSnapshot([first]);
    const before = useSubtitleStore.getState();

    expect(() => store.applyNativeSubtitleSnapshot([first, second])).toThrow(
      'Duplicate native subtitle language'
    );
    expect(useSubtitleStore.getState().nativeCueCache).toEqual(before.nativeCueCache);
    expect(useSubtitleStore.getState().nativeTrackIdentityCache).toEqual(
      before.nativeTrackIdentityCache
    );
    expect(useSubtitleStore.getState().subtitleRevision).toBe(before.subtitleRevision);
  });

  it('increments its content-local revision for every presentation mutation', () => {
    expect(useSubtitleStore.getInitialState().subtitleRevision).toBe(0);

    const store = useSubtitleStore.getState();
    const initialRevision = store.subtitleRevision;

    store.setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Native' }]);
    store.clearNativeCues();
    store.setRegisteredSelection('learning', registeredSelection);
    store.clearRegisteredSelection('learning');
    store.clearCaches();

    expect(useSubtitleStore.getState().subtitleRevision).toBe(initialRevision + 6);
  });
});
