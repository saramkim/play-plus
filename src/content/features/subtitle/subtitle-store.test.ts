import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  RegisteredSubtitleSelection,
  selectSubtitleTrack,
  useSubtitleStore,
} from './subtitle-store';

const registeredSelection: RegisteredSubtitleSelection = {
  subtitleId: 'subtitle-00000000-0000-4000-8000-000000000001',
  cues: [{ start: 10, end: 11, text: 'Registered' }],
  delay: 2,
};

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
    expect(useSubtitleStore.getState().registeredSelections).toEqual({ learning: null, support: null });
  });
});
