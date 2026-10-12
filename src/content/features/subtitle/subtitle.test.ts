import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { elementStore } from '@/content/core/store/element-store';
import { useVideoStore } from '@/content/core/store/video-store';
import { videoManager } from '@/content/core/video/video-manager';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';

import { initializeSubtitleSync, syncSubtitles } from './subtitle';
import { selectSubtitleTrack, useSubtitleStore } from './subtitle-store';

vi.mock('@utils/coupang-play', () => ({ getCoupangPlayVideoId: () => 'video-test' }));

useSubtitleStore.subscribe((state) => {
  const status = usePlaybackContextStore.getState().status;
  if (status) usePlaybackContextStore.setState({ status: { ...status, subtitleIdentity: {
    learning: selectSubtitleTrack(state, 'learning').cues.length ? 'learning-source' : null,
    support: selectSubtitleTrack(state, 'support').cues.length ? 'support-source' : null,
    subtitleRevision: state.subtitleRevision,
  } } });
});

const registeredSubtitleId = 'subtitle-00000000-0000-4000-8000-000000000001';

describe('canonical subtitle presentation', () => {
  beforeEach(() => {
    const video = document.createElement('video');
    vi.spyOn(videoManager, 'get').mockReturnValue(video);
    vi.spyOn(videoManager, 'isCurrent').mockReturnValue(true);
    useSubtitleStore.getState().clearCaches();
    useListeningMissionActiveStore.getState().setActive(false);
    usePlaybackContextStore.setState({ status: SUPPORTED_PLAYBACK_CONTEXT });
    useSubtitleStore.getState().setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
    useVideoStore.setState({ currentTime: 0 });
    elementStore.getSubtitleElement('learning').textContent = '';
    elementStore.getSubtitleElement('support').textContent = '';
    vi.clearAllMocks();
  });

  it('applies a registered delay exactly once and renders plain text', () => {
    const store = useSubtitleStore.getState();
    store.setSettings({
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
    });
    store.setRegisteredSelection('learning', {
      subtitleId: registeredSubtitleId,
      cues: [
        {
          start: 10,
          end: 11,
          text: '<img src="https://example.invalid/pixel" alt="1 > 0"><b>Registered &amp; safe</b>',
        },
      ],
      delay: 2,
    });

    syncSubtitles(12.5, true);

    const learningElement = elementStore.getSubtitleElement('learning');
    expect(learningElement.textContent).toBe('Registered & safe');
    expect(learningElement.querySelector('img')).toBeNull();
    expect(learningElement.querySelector('b')).toBeNull();
    expect(elementStore.getSubtitleElement('support').textContent).toBe('');
  });

  it('renders native markup and entities as plain text while preserving lines and empty cues', () => {
    const store = useSubtitleStore.getState();
    store.setNativeCues('en', [
      { start: 1, end: 2, text: '<i>Native &amp; learning</i>' },
      { start: 3, end: 4, text: '<i>First line</i>\nsecond line' },
      { start: 5, end: 6, text: '<i></i>' },
    ]);

    const learningElement = elementStore.getSubtitleElement('learning');

    syncSubtitles(1.5, true);
    expect(learningElement.textContent).toBe('Native & learning');
    expect(learningElement.querySelector('i')).toBeNull();

    syncSubtitles(3.5);
    expect(learningElement.textContent).toBe('First line\nsecond line');

    syncSubtitles(5.5);
    expect(learningElement.textContent).toBe('');
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


  it('renders support independently and clears it for hidden, stale, ad or mission state', () => {
    const store = useSubtitleStore.getState();
    store.setNativeCues('ko', [{ start: 1, end: 2, text: 'Support alone' }]);
    const status = usePlaybackContextStore.getState().status!;
    usePlaybackContextStore.setState({ status: { ...status, learningAvailable: false } });
    syncSubtitles(1.5);
    expect(elementStore.getSubtitleElement('learning').textContent).toBe('');
    expect(elementStore.getSubtitleElement('support').textContent).toBe('Support alone');
    const display = structuredClone(store.subtitleDisplay); display.support.visibility = 'hidden';
    store.setSettings({ learningProfile: store.learningProfile, subtitleDisplay: display });
    syncSubtitles(1.5); expect(elementStore.getSubtitleElement('support').textContent).toBe('');
    display.support.visibility = 'visible'; store.setSettings({ learningProfile: store.learningProfile, subtitleDisplay: display });
    for (const next of [
      { ...status, lifecycle: 'advertisement' as const },
      { ...status, subtitleIdentity: { ...status.subtitleIdentity, subtitleRevision: -1 } },
      { ...status, subtitleIdentity: { ...status.subtitleIdentity, support: null } },
    ]) {
      usePlaybackContextStore.setState({ status: next }); syncSubtitles(1.5);
      expect(elementStore.getSubtitleElement('support').textContent).toBe('');
    }
    usePlaybackContextStore.setState({ status }); useListeningMissionActiveStore.getState().setActive(true);
    syncSubtitles(1.5); expect(elementStore.getSubtitleElement('support').textContent).toBe('');
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
