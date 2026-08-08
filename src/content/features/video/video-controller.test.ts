import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import type {
  V2SyncStorageApi,
  V2SyncStorageChanges,
  V2SyncStorageKey,
} from '@storage/v2/sync-storage';
import type { V2SyncStorage } from '@storage/v2/type';
import { sendMessage } from '@utils/message';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useToastStore } from '@/content/core/store/toast-store';
import { videoManager } from '@/content/core/video/video-manager';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

import {
  useVideoControlStore,
  VideoController,
  VideoControllerDependencies,
} from './video-controller';

vi.mock('@utils/message', () => ({ sendMessage: vi.fn() }));

describe('canonical video controller lifecycle', () => {
  beforeEach(resetStores);

  it('keeps construction inert, starts once, and owns one canonical subscription and key listener', async () => {
    const storage = new FakeSyncStorage();
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const removeEventListener = vi.spyOn(document, 'removeEventListener');
    const controller = new VideoController(createDependencies(storage));

    expect(storage.getAll).not.toHaveBeenCalled();
    expect(storage.subscribe).not.toHaveBeenCalled();

    const first = controller.start();
    expect(controller.start()).toBe(first);
    await first;

    expect(storage.getAll).toHaveBeenCalledOnce();
    expect(storage.subscribe).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(useVideoControlStore.getState().ready).toBe(true);

    controller.stop();
    controller.stop();
    expect(storage.removeListeners[0]).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
    expect(useVideoControlStore.getState().ready).toBe(false);

    await controller.start();
    expect(storage.getAll).toHaveBeenCalledTimes(2);
    expect(storage.subscribe).toHaveBeenCalledTimes(2);
    controller.stop();
  });

  it('does not attach after cancellation during canonical settings loading', async () => {
    const storage = new FakeSyncStorage();
    const settings = deferred<V2SyncStorage>();
    storage.getAll.mockReturnValueOnce(settings.promise);
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const controller = new VideoController(createDependencies(storage));

    const start = controller.start();
    controller.stop();
    settings.resolve(structuredClone(DEFAULT_V2_SYNC_STORAGE));
    await start;

    expect(storage.subscribe).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(useVideoControlStore.getState().ready).toBe(false);
  });

  it('rebinds canonical shortcut and speed changes and fails closed on deletion', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    const execute = vi.spyOn(controller, 'execute').mockResolvedValue();
    await controller.start();

    const shortcuts = {
      ...DEFAULT_V2_SYNC_STORAGE.shortcuts,
      enabled: true,
      previousCue: 'KeyP',
      nextCue: 'KeyN',
      repeatCurrentCue: 'KeyT',
    };
    const playbackSpeed = {
      enabled: true,
      increase: 'KeyU',
      decrease: 'KeyD',
      reset: 'KeyR',
    };
    storage.emit({ shortcuts: { newValue: shortcuts }, playbackSpeed: { newValue: playbackSpeed } });

    dispatchKey('KeyP');
    dispatchKey('KeyN');
    dispatchKey('KeyT');
    expect(execute.mock.calls.map(([command]) => command)).toEqual([
      'previous',
      'next',
      'repeat-current',
    ]);
    dispatchKey('KeyU');
    expect(usePlaybackSpeedStore.getState().currentSpeed).toBe(1.1);
    dispatchKey('KeyD');
    expect(usePlaybackSpeedStore.getState().currentSpeed).toBe(1);

    storage.emit({ playbackSpeed: { oldValue: playbackSpeed } });
    expect(useVideoControlStore.getState().ready).toBe(false);
    expect(storage.removeListeners[0]).toHaveBeenCalledOnce();
    execute.mockClear();
    dispatchKey('KeyN');
    expect(execute).not.toHaveBeenCalled();
  });

  it('does not bind learning commands while the shortcuts master is off', async () => {
    const storage = new FakeSyncStorage({
      shortcuts: {
        ...DEFAULT_V2_SYNC_STORAGE.shortcuts,
        enabled: false,
        previousCue: 'KeyP',
        nextCue: 'KeyN',
        repeatCurrentCue: 'KeyT',
      },
    });
    const controller = new VideoController(createDependencies(storage));
    const execute = vi.spyOn(controller, 'execute').mockResolvedValue();
    await controller.start();

    dispatchKey('KeyP');
    dispatchKey('KeyN');
    dispatchKey('KeyT');

    expect(execute).not.toHaveBeenCalled();
    controller.stop();
  });

  it('fails closed without attaching when initial canonical settings are unavailable', async () => {
    const storage = new FakeSyncStorage();
    storage.getAll.mockRejectedValueOnce(new Error('missing canonical settings'));
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const controller = new VideoController(createDependencies(storage));

    await expect(controller.start()).rejects.toThrow('missing canonical settings');

    expect(storage.subscribe).not.toHaveBeenCalled();
    expect(addEventListener).not.toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(useVideoControlStore.getState().ready).toBe(false);
  });

  it('fails closed when a subscribed canonical change cannot be validated', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    await controller.start();

    storage.failSubscription();

    expect(useVideoControlStore.getState().ready).toBe(false);
    expect(storage.removeListeners[0]).toHaveBeenCalledOnce();
  });
});

describe('canonical learning commands', () => {
  beforeEach(resetStores);

  it('does not seek when previous has no target or repeat has no current cue', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    await controller.start();
    const observedVideo = createObservedVideo(0);
    vi.spyOn(videoManager, 'get').mockReturnValue(observedVideo.video);
    useSubtitleStore.getState().setNativeCues('en', learningCues);

    await controller.execute('previous');
    observedVideo.setObservedTime(7);
    await controller.execute('next');
    observedVideo.setObservedTime(4.75);
    await controller.execute('repeat-current');

    expect(observedVideo.seek).not.toHaveBeenCalled();
    controller.stop();
  });

  it('executes previous, next, and repeat directly while the shortcuts master is off', async () => {
    const storage = new FakeSyncStorage({
      shortcuts: {
        ...DEFAULT_V2_SYNC_STORAGE.shortcuts,
        enabled: false,
      },
    });
    const controller = new VideoController(createDependencies(storage));
    await controller.start();
    const observedVideo = createObservedVideo(3.75);
    vi.spyOn(videoManager, 'get').mockReturnValue(observedVideo.video);
    const store = useSubtitleStore.getState();
    store.setRegisteredSelection('learning', {
      subtitleId: 'subtitle-00000000-0000-4000-8000-000000000001',
      cues: learningCues,
      delay: 0.5,
    });

    await controller.execute('previous');
    observedVideo.setObservedTime(3.75);
    await controller.execute('next');
    observedVideo.setObservedTime(3.75);
    await controller.execute('repeat-current');

    expect(observedVideo.seek.mock.calls.map(([time]) => time)).toEqual([1.5, 5.5, 3.5]);
    controller.stop();
  });

  it('sends exactly one canonical learning-only card and sends nothing without a current cue', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    await controller.start();
    const observedVideo = createObservedVideo(1.5);
    vi.spyOn(videoManager, 'get').mockReturnValue(observedVideo.video);
    const store = useSubtitleStore.getState();
    store.setSettings({
      learningProfile: { learningLanguage: 'en', supportLanguage: null },
      subtitleDisplay: DEFAULT_V2_SYNC_STORAGE.subtitleDisplay,
    });
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Learning only' }]);
    vi.mocked(sendMessage).mockResolvedValue({ success: true, data: {} } as never);

    await controller.execute('save');

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith('addLearningCard', {
      card: expect.objectContaining({
        content: { learning: { text: 'Learning only', language: 'en' } },
        source: expect.objectContaining({ startTime: 1, endTime: 2 }),
        studyState: 'active',
      }),
    });
    expect(lastToastMessage()).toBe(
      'v2_learning_card_saved_without_support'
    );
    observedVideo.setObservedTime(3);
    await controller.execute('save');
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(observedVideo.seek).not.toHaveBeenCalled();
    expect(lastToastMessage()).toBe(
      'v2_no_current_learning_cue_to_save'
    );
    controller.stop();
  });

  it('ignores a concurrent current-cue save while the shared persistence lock is pending', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    await controller.start();
    vi.spyOn(videoManager, 'get').mockReturnValue(createObservedVideo(1.5).video);
    useSubtitleStore.getState().setNativeCues('en', [
      { start: 1, end: 2, text: 'Learning once' },
    ]);
    const persistence = deferred<{ success: true; data: object }>();
    vi.mocked(sendMessage).mockReturnValueOnce(persistence.promise as never);

    const firstSave = controller.execute('save');
    await controller.execute('save');

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(useToastStore.getState().toasts).toHaveLength(0);
    persistence.resolve({ success: true, data: {} });
    await firstSave;
    expect(lastToastMessage()).toBe('v2_learning_card_saved_without_support');
    controller.stop();
  });

  it('distinguishes paired save success and handles response or transport failure', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    await controller.start();
    vi.spyOn(videoManager, 'get').mockReturnValue(createObservedVideo(1.5).video);
    const store = useSubtitleStore.getState();
    store.setNativeCues('en', [{ start: 1, end: 2, text: 'Learning' }]);
    store.setNativeCues('ko', [{ start: 1, end: 2, text: 'Support' }]);

    vi.mocked(sendMessage).mockResolvedValueOnce({ success: true, data: {} } as never);
    await controller.execute('save');
    expect(lastToastMessage()).toBe('v2_learning_card_saved');

    vi.mocked(sendMessage).mockResolvedValueOnce({ success: false, message: 'private' } as never);
    await controller.execute('save');
    expect(lastToastMessage()).toBe(
      'v2_learning_card_save_error'
    );

    vi.mocked(sendMessage).mockRejectedValueOnce(new Error('private transport detail'));
    await controller.execute('save');
    expect(lastToastMessage()).toBe(
      'v2_learning_card_save_error'
    );
    controller.stop();
  });

  it('persists support visibility and disables the operation without a support language', async () => {
    const storage = new FakeSyncStorage();
    const controller = new VideoController(createDependencies(storage));
    const set = vi.spyOn(storage, 'set');

    await expect(controller.toggleSupportSubtitleVisibility()).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith(
      'subtitleDisplay',
      expect.objectContaining({ support: expect.objectContaining({ visibility: 'hidden' }) })
    );
    expect(useSubtitleStore.getState().subtitleDisplay.support.visibility).toBe('hidden');

    const state = useSubtitleStore.getState();
    state.setSettings({
      learningProfile: { ...state.learningProfile, supportLanguage: null },
      subtitleDisplay: state.subtitleDisplay,
    });
    set.mockClear();
    await expect(controller.toggleSupportSubtitleVisibility()).resolves.toBe(false);
    expect(set).not.toHaveBeenCalled();

    state.setSettings({
      learningProfile: { ...state.learningProfile, supportLanguage: 'ko' },
      subtitleDisplay: state.subtitleDisplay,
    });
    set.mockRejectedValueOnce(new Error('private sync failure'));
    await expect(controller.toggleSupportSubtitleVisibility()).resolves.toBe(false);
    expect(lastToastMessage()).toBe(
      'v2_support_subtitle_toggle_error'
    );
  });
});

const learningCues = [
  { start: 1, end: 2, text: 'First' },
  { start: 3, end: 4, text: 'Second' },
  { start: 5, end: 6, text: 'Third' },
];

const lastToastMessage = () => {
  const { toasts } = useToastStore.getState();
  return toasts[toasts.length - 1]?.message;
};

const resetStores = () => {
  useVideoControlStore.getState().reset();
  usePlaybackSpeedStore.getState().resetSpeed();
  useToastStore.getState().clearToasts();
  const subtitleStore = useSubtitleStore.getState();
  subtitleStore.clearCaches();
  subtitleStore.setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
  vi.mocked(sendMessage).mockReset();
};

const createDependencies = (storage: V2SyncStorageApi): VideoControllerDependencies => ({ document, storage });

const dispatchKey = (code: string) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, code }));
};

const createObservedVideo = (initialTime: number) => {
  const video = document.createElement('video');
  let currentTime = initialTime;
  const seek = vi.fn((time: number) => {
    currentTime = time;
  });
  Object.defineProperty(video, 'currentTime', {
    configurable: true,
    get: () => currentTime,
    set: seek,
  });
  return {
    seek,
    setObservedTime: (time: number) => {
      currentTime = time;
    },
    video,
  };
};

class FakeSyncStorage implements V2SyncStorageApi {
  values: V2SyncStorage;
  removeListeners: ReturnType<typeof vi.fn>[] = [];
  private errorListeners = new Set<() => void>();
  private listeners = new Set<(changes: V2SyncStorageChanges) => void>();

  getAll = vi.fn(async () => structuredClone(this.values));

  subscribe = vi.fn((callback: (changes: V2SyncStorageChanges) => void, onError?: () => void) => {
    this.listeners.add(callback);
    if (onError) this.errorListeners.add(onError);
    const remove = vi.fn(() => {
      this.listeners.delete(callback);
      if (onError) this.errorListeners.delete(onError);
    });
    this.removeListeners.push(remove);
    return { remove };
  });

  constructor(overrides: Partial<V2SyncStorage> = {}) {
    this.values = { ...structuredClone(DEFAULT_V2_SYNC_STORAGE), ...structuredClone(overrides) };
  }

  async get<K extends V2SyncStorageKey>(key: K) {
    return structuredClone(this.values[key]);
  }

  async set<K extends V2SyncStorageKey>(key: K, value: V2SyncStorage[K]) {
    Object.assign(this.values, { [key]: structuredClone(value) });
  }

  async setMany(values: Partial<V2SyncStorage>) {
    Object.assign(this.values, structuredClone(values));
  }

  emit(changes: V2SyncStorageChanges) {
    for (const listener of this.listeners) listener(structuredClone(changes));
  }

  failSubscription() {
    for (const listener of this.errorListeners) listener();
  }
}

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
