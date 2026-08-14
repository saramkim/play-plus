import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { elementStore } from '@/content/core/store/element-store';
import { useVideoStore } from '@/content/core/store/video-store';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';

import { initializeSubtitleSync, syncSubtitles } from './subtitle';
import { useSubtitleStore } from './subtitle-store';

const registeredSubtitleId = 'subtitle-00000000-0000-4000-8000-000000000001';

describe('canonical subtitle presentation', () => {
  beforeEach(() => {
    useSubtitleStore.getState().clearCaches();
    useListeningMissionActiveStore.getState().setActive(false);
    usePlaybackContextStore.setState({ status: SUPPORTED_PLAYBACK_CONTEXT });
    useSubtitleStore.getState().setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
    useVideoStore.setState({ currentTime: 0 });
    elementStore.getSubtitleElement('learning').textContent = '';
    elementStore.getSubtitleElement('support').textContent = '';
    vi.clearAllMocks();
  });

  it('applies a registered delay exactly once and renders cue text as text', () => {
    const store = useSubtitleStore.getState();
    store.setSettings({
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
    });
    store.setRegisteredSelection('learning', {
      subtitleId: registeredSubtitleId,
      cues: [{ start: 10, end: 11, text: '<img src=x onerror=alert(1)>Learning' }],
      delay: 2,
    });

    syncSubtitles(12.5, true);

    const learningElement = elementStore.getSubtitleElement('learning');
    expect(learningElement.textContent).toBe('<img src=x onerror=alert(1)>Learning');
    expect(learningElement.querySelector('img')).toBeNull();
    expect(elementStore.getSubtitleElement('support').textContent).toBe('');
  });

  it('clears hidden roles and visible roles without a current cue', () => {
    const store = useSubtitleStore.getState();
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Learning' }]);
    syncSubtitles(1.5, true);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('Learning');

    const subtitleDisplay = structuredClone(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    subtitleDisplay.learning.visibility = 'hidden';
    store.setSettings({ learningProfile: DEFAULT_V2_SYNC_STORAGE.learningProfile, subtitleDisplay });
    syncSubtitles(1.5, true);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');
    expect(elementStore.getSubtitleElement('learning').style.display).toBe('none');

    subtitleDisplay.learning.visibility = 'visible';
    store.setSettings({ learningProfile: DEFAULT_V2_SYNC_STORAGE.learningProfile, subtitleDisplay });
    syncSubtitles(3, true);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');
  });

  it('blanks both Play Plus roles during a mission and resyncs canonical text after release', () => {
    const store = useSubtitleStore.getState();
    store.setSettings({
      learningProfile: { learningLanguage: 'en', supportLanguage: 'ko' },
      subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
    });
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Learning' }]);
    store.setNativeCues('ko', [{ start: 1, end: 2, text: 'Support' }]);

    syncSubtitles(1.5);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('Learning');
    expect(elementStore.getSubtitleElement('support').textContent).toBe('Support');

    useListeningMissionActiveStore.getState().setActive(true);
    syncSubtitles(1.5);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');
    expect(elementStore.getSubtitleElement('support').textContent).toBe('');

    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Changed while active' }]);
    syncSubtitles(1.5);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');

    useListeningMissionActiveStore.getState().setActive(false);
    syncSubtitles(1.5);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('Changed while active');
    expect(elementStore.getSubtitleElement('support').textContent).toBe('Support');
  });

  it('strictly loads canonical settings and follows validated storage and video changes', async () => {
    const storageValues = structuredClone(DEFAULT_V2_SYNC_STORAGE) as Record<string, unknown>;
    let listener: ((changes: Record<string, chrome.storage.StorageChange>) => void) | undefined;
    vi.mocked(chrome.storage.sync.get).mockImplementation(async (keys) => {
      const requested = Array.isArray(keys) ? keys : [String(keys)];
      return Object.fromEntries(requested.map((key) => [key, structuredClone(storageValues[key])])) as never;
    });
    vi.mocked(chrome.storage.sync.onChanged.addListener).mockImplementation((callback) => {
      listener = callback;
    });

    const cleanup = await initializeSubtitleSync();
    expect(useSubtitleStore.getState().learningProfile).toEqual(DEFAULT_V2_SYNC_STORAGE.learningProfile);

    useSubtitleStore.getState().setNativeCues('en', [{ start: 1, end: 2, text: 'Synced' }]);
    useVideoStore.getState().setCurrentTime(1.5);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('Synced');

    listener?.({
      learningProfile: { newValue: { learningLanguage: 'ko', supportLanguage: null } },
    });
    expect(useSubtitleStore.getState().learningProfile).toEqual({ learningLanguage: 'ko', supportLanguage: null });
    useSubtitleStore.getState().setNativeCues('ko', [{ start: 1, end: 2, text: 'Synced' }]);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('Synced');

    expect(() => listener?.({ subtitleDisplay: { newValue: { learning: {} } } })).not.toThrow();
    expect(useSubtitleStore.getState().subtitleDisplay).toEqual(DEFAULT_V2_SYNC_STORAGE.subtitleDisplay);
    expect(useSubtitleStore.getState().nativeCueCache).toEqual({});
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');

    useSubtitleStore.getState().setNativeCues('ko', [{ start: 1, end: 2, text: 'Synced' }]);
    expect(() =>
      listener?.({ learningProfile: { oldValue: DEFAULT_V2_SYNC_STORAGE.learningProfile } })
    ).not.toThrow();
    expect(useSubtitleStore.getState().learningProfile).toEqual({ learningLanguage: 'ko', supportLanguage: null });
    expect(useSubtitleStore.getState().nativeCueCache).toEqual({});
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');

    cleanup();
    expect(chrome.storage.sync.onChanged.removeListener).toHaveBeenCalledWith(listener);
  });

  it('fails closed when canonical sync settings are missing', async () => {
    vi.mocked(chrome.storage.sync.get).mockImplementation(async () => ({}) as never);

    await expect(initializeSubtitleSync()).rejects.toThrow();
    expect(chrome.storage.sync.onChanged.removeListener).toHaveBeenCalledOnce();
  });
});

const SUPPORTED_PLAYBACK_CONTEXT = {
  contentEpoch: 1,
  contentInstanceId: 'content-test',
  learningAvailable: true,
  lifecycle: 'content',
  mediaAttachmentRevision: 1,
  missionResumeRequired: false,
  routeChangedAt: 1,
  routeKind: 'episode',
  subtitleIdentity: { learning: 'native:en', subtitleRevision: 1, support: null },
  videoId: 'video-test',
  videoRevision: 1,
} as const;
