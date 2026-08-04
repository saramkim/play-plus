import { getRegisteredSubtitles } from '@storage/registered-subtitle';
import { getLocalSubtitle } from '@storage/subtitle';
import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { LANGUAGES, Language } from '@utils/constants';
import type { MessageSchema } from '@utils/message/type';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

import { coupangStrategy } from './coupang-play';
import { createVideoLifecycleHandler, initializeMessageListener } from './message-handler';
import { VideoLifecycleEvent } from './video-lifecycle/video-lifecycle-monitor';

vi.mock('@storage/registered-subtitle', () => ({ getRegisteredSubtitles: vi.fn() }));
vi.mock('@storage/subtitle', () => ({ getLocalSubtitle: vi.fn() }));
vi.mock('./coupang-play', () => ({ coupangStrategy: { fetchSubtitles: vi.fn() } }));

const SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001';
const SECOND_SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000002';

const contentEvent = (video: HTMLVideoElement): VideoLifecycleEvent => ({
  state: 'content',
  video,
  videoId: '123e4567-e89b-12d3-a456-426614174000',
  delayed: false,
});

const createLifecycleDependencies = () => {
  let currentVideo: HTMLVideoElement | null = null;
  return {
    dependencies: {
      getVideo: () => currentVideo,
      isCurrentVideo: (video: HTMLVideoElement) => currentVideo === video && video.isConnected,
      setVideo: vi.fn((video: HTMLVideoElement) => {
        currentVideo = video;
      }),
      clearVideo: vi.fn(() => {
        currentVideo = null;
      }),
      clearNativeCues: vi.fn(),
      setupContainer: vi.fn(),
      resetElements: vi.fn(),
      setCurrentTime: vi.fn(),
      setDetectionStatus: vi.fn(),
      reportContentStatus: vi.fn(),
    },
    getCurrentVideo: () => currentVideo,
  };
};

describe('canonical video lifecycle handler', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('attaches a new content video once and reports detection', () => {
    const { dependencies, getCurrentVideo } = createLifecycleDependencies();
    const handle = createVideoLifecycleHandler(dependencies);
    const video = document.createElement('video');
    document.body.appendChild(video);

    handle(contentEvent(video));
    handle(contentEvent(video));

    expect(getCurrentVideo()).toBe(video);
    expect(dependencies.setVideo).toHaveBeenCalledOnce();
    expect(dependencies.setupContainer).toHaveBeenCalledOnce();
    expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('detected');
    expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(true);
  });

  it.each(['advertisement', 'placeholder', 'waiting', 'transitioning'] as const)(
    'clears content state and time for %s',
    (state) => {
      const { dependencies, getCurrentVideo } = createLifecycleDependencies();
      const handle = createVideoLifecycleHandler(dependencies);
      const video = document.createElement('video');
      document.body.appendChild(video);
      handle(contentEvent(video));

      handle({ state, video: state === 'advertisement' ? video : null, videoId: null, delayed: false });

      expect(getCurrentVideo()).toBeNull();
      expect(dependencies.clearVideo).toHaveBeenCalledOnce();
      expect(dependencies.clearNativeCues).toHaveBeenCalledOnce();
      expect(dependencies.resetElements).toHaveBeenCalledOnce();
      expect(dependencies.setCurrentTime).toHaveBeenCalledWith(0);
      expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('detecting');
      expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(false);
    }
  );

  it('reports delayed failure without clearing absent content', () => {
    const { dependencies } = createLifecycleDependencies();
    const handle = createVideoLifecycleHandler(dependencies);

    handle({ state: 'waiting', video: null, videoId: null, delayed: true });

    expect(dependencies.clearVideo).not.toHaveBeenCalled();
    expect(dependencies.resetElements).not.toHaveBeenCalled();
    expect(dependencies.setDetectionStatus).toHaveBeenLastCalledWith('failed');
    expect(dependencies.reportContentStatus).toHaveBeenLastCalledWith(false);
  });

  it('clears native cues when Coupang replaces one content video directly', () => {
    const { dependencies, getCurrentVideo } = createLifecycleDependencies();
    const handle = createVideoLifecycleHandler(dependencies);
    const first = document.createElement('video');
    const second = document.createElement('video');
    document.body.append(first, second);
    handle(contentEvent(first));

    handle(contentEvent(second));

    expect(getCurrentVideo()).toBe(second);
    expect(dependencies.clearNativeCues).toHaveBeenCalledOnce();
    expect(dependencies.resetElements).toHaveBeenCalledOnce();
    expect(dependencies.setCurrentTime).toHaveBeenCalledWith(0);
    expect(dependencies.setVideo).toHaveBeenCalledTimes(2);
  });
});

describe('canonical content messages', () => {
  beforeEach(() => {
    vi.mocked(getRegisteredSubtitles).mockReset().mockResolvedValue([]);
    vi.mocked(getLocalSubtitle).mockReset();
    vi.mocked(coupangStrategy.fetchSubtitles).mockReset().mockResolvedValue([]);
    const store = useSubtitleStore.getState();
    store.clearCaches();
    store.setSettings(structuredClone(DEFAULT_V2_SYNC_STORAGE));
  });

  it('acquires raw native cues for every supported language and ignores unsupported tracks', async () => {
    const languages = Object.keys(LANGUAGES) as Language[];
    const tracks = languages.map((language, index) => ({
      lang: language,
      subtitleData: [{ start: index, end: index + 1, text: language }],
    }));
    const expectedCache = Object.fromEntries(
      tracks.map(({ lang, subtitleData }) => [lang, subtitleData])
    );
    useSubtitleStore.getState().setNativeCues('ko', [{ start: 0, end: 1, text: 'Stale' }]);
    vi.mocked(coupangStrategy.fetchSubtitles).mockResolvedValue([
      ...tracks,
      { lang: 'unsupported', subtitleData: [{ start: 1, end: 2, text: 'Ignored' }] },
    ]);
    const { dispatch } = createMessageHarness();

    const request = dispatch('fetchVideoMetadata', { url: 'https://example.test', headers: [] });
    expect(request.result).toBe(true);
    await expectResponse(request.sendResponse, { success: true });

    expect(useSubtitleStore.getState().nativeCueCache).toEqual(expectedCache);
  });

  it('fails native acquisition without retaining a partial cache when a supported body is invalid', async () => {
    useSubtitleStore.getState().setNativeCues('ko', [{ start: 0, end: 1, text: 'Stale' }]);
    vi.mocked(coupangStrategy.fetchSubtitles).mockResolvedValue([
      { lang: 'en', subtitleData: [{ start: 1, end: 2, text: 'Valid' }] },
      { lang: 'ja', subtitleData: [{ start: 3, end: 2, text: 'Invalid' }] },
    ]);
    const { dispatch } = createMessageHarness();

    const request = dispatch('fetchVideoMetadata', { url: 'https://example.test', headers: [] });
    expect(request.result).toBe(true);
    await expectFailure(request.sendResponse);

    expect(useSubtitleStore.getState().nativeCueCache).toEqual({});
  });

  it('sets a registered role with raw cues and a separately validated delay, then refreshes it', async () => {
    const initialCues = [{ start: 10, end: 11, text: 'Initial' }];
    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SUBTITLE_ID, title: 'English', language: 'en', savedAt: '2026-08-04T00:00:00.000Z', delay: 2 },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue(initialCues);
    const { dispatch } = createMessageHarness();

    const select = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID });
    expect(select.result).toBe(true);
    await expectResponse(select.sendResponse, { success: true });
    expect(useSubtitleStore.getState().registeredSelections.learning).toEqual({
      subtitleId: SUBTITLE_ID,
      cues: initialCues,
      delay: 2,
    });

    const refreshedCues = [{ start: 20, end: 21, text: 'Refreshed' }];
    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SUBTITLE_ID, title: 'English', language: 'en', savedAt: '2026-08-04T00:00:00.000Z', delay: -1 },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue(refreshedCues);
    const refresh = dispatch('refreshRegisteredSubtitle', { subtitleId: SUBTITLE_ID });
    expect(refresh.result).toBe(true);
    await expectResponse(refresh.sendResponse, { success: true });
    expect(useSubtitleStore.getState().registeredSelections.learning).toEqual({
      subtitleId: SUBTITLE_ID,
      cues: refreshedCues,
      delay: -1,
    });
  });

  it('fails closed for mismatched languages, invalid delays, and invalid raw bodies', async () => {
    const { dispatch } = createMessageHarness();

    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SUBTITLE_ID, title: 'Korean', language: 'ko', savedAt: '2026-08-04T00:00:00.000Z' },
    ]);
    const languageFailure = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID });
    expect(languageFailure.result).toBe(true);
    await expectFailure(languageFailure.sendResponse);

    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      {
        id: SUBTITLE_ID,
        title: 'English',
        language: 'en',
        savedAt: '2026-08-04T00:00:00.000Z',
        delay: Number.NaN,
      },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue([{ start: 1, end: 2, text: 'Cue' }]);
    const delayFailure = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID });
    expect(delayFailure.result).toBe(true);
    await expectFailure(delayFailure.sendResponse);

    vi.mocked(getRegisteredSubtitles).mockResolvedValue([
      { id: SECOND_SUBTITLE_ID, title: 'English', language: 'en', savedAt: '2026-08-04T00:00:00.000Z' },
    ]);
    vi.mocked(getLocalSubtitle).mockResolvedValue([{ start: 2, end: 1, text: 'Invalid' }]);
    const bodyFailure = dispatch('setSubtitleRole', { role: 'learning', subtitleId: SECOND_SUBTITLE_ID });
    expect(bodyFailure.result).toBe(true);
    await expectFailure(bodyFailure.sendResponse);

    expect(useSubtitleStore.getState().registeredSelections.learning).toBeNull();
  });

  it('returns true and responds exactly once for every asynchronous failure', async () => {
    vi.mocked(coupangStrategy.fetchSubtitles).mockRejectedValue(new Error('network'));
    useSubtitleStore.getState().setRegisteredSelection('learning', {
      subtitleId: SUBTITLE_ID,
      cues: [{ start: 1, end: 2, text: 'Selected' }],
      delay: 0,
    });
    const { dispatch } = createMessageHarness();

    for (const [message, params] of [
      ['fetchVideoMetadata', { url: 'https://example.test', headers: [] }],
      ['setSubtitleRole', { role: 'learning', subtitleId: SUBTITLE_ID }],
      ['refreshRegisteredSubtitle', { subtitleId: SUBTITLE_ID }],
    ] as const) {
      const request = dispatch(message, params);
      expect(request.result).toBe(true);
      await expectFailure(request.sendResponse);
      expect(request.sendResponse).toHaveBeenCalledOnce();
    }
  });

  it('removes its listener and monitor exactly once', () => {
    const { dispose, monitor, remove } = createMessageHarness();

    dispose();
    dispose();

    expect(remove).toHaveBeenCalledOnce();
    expect(monitor.stop).toHaveBeenCalledOnce();
  });
});

type CapturedRequest = {
  message: keyof MessageSchema;
  params: unknown;
  sender: chrome.runtime.MessageSender;
  sendResponse: (response: unknown) => void;
};

type CapturedListener = (request: CapturedRequest) => true | void;

const createMessageHarness = () => {
  let listener: CapturedListener | undefined;
  const remove = vi.fn();
  const monitor = { refresh: vi.fn(), start: vi.fn(), stop: vi.fn() };
  const registerMessageListener = vi.fn((callback: unknown) => {
    listener = callback as CapturedListener;
    return { remove };
  });
  const dispose = initializeMessageListener({
    createVideoLifecycleMonitor: () => monitor as never,
    registerMessageListener: registerMessageListener as never,
  });

  return {
    dispose,
    monitor,
    remove,
    dispatch: (message: keyof MessageSchema, params: unknown) => {
      const sendResponse = vi.fn();
      const result = listener?.({ message, params, sender: {}, sendResponse });
      return { result, sendResponse };
    },
  };
};

const expectResponse = async (sendResponse: ReturnType<typeof vi.fn>, response: unknown) => {
  await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith(response));
};

const expectFailure = async (sendResponse: ReturnType<typeof vi.fn>) => {
  await vi.waitFor(() =>
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      message: 'v2_content_action_failed',
    })
  );
};
