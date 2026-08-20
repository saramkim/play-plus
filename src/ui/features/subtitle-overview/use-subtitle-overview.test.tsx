import { act } from 'react';

import type { TabInfo } from '@storage/tab';
import type {
  ContentVideoIdentity,
  SubtitleOverviewCue,
  SubtitleOverviewResponse,
  VideoTimeResponse,
} from '@utils/message/type';
import type { PlaybackContextStatus } from '@utils/playback-context';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSubtitleOverview } from './use-subtitle-overview';

interface MockTabStoreState {
  activeTab: chrome.tabs.Tab | null;
  playbackContext: PlaybackContextStatus | null;
  tabInfo: TabInfo | null;
}

const harness = vi.hoisted(() => ({
  sendMessageToTab: vi.fn(),
  state: {
    activeTab: null,
    playbackContext: null,
    tabInfo: null,
  } as MockTabStoreState,
}));

vi.mock('@utils/message', () => ({ sendMessageToTab: harness.sendMessageToTab }));
vi.mock('@/ui/store/tab-store', () => {
  const useTabStore = Object.assign(
    (selector: (state: MockTabStoreState) => unknown) => selector(harness.state),
    { getState: () => harness.state }
  );
  return { useTabStore };
});

const IDENTITY_A: ContentVideoIdentity = {
  contentEpoch: 1,
  contentInstanceId: 'content-a',
  routeChangedAt: 100,
  videoId: 'video-a',
  videoRevision: 1,
};

const IDENTITY_B: ContentVideoIdentity = {
  contentEpoch: 1,
  contentInstanceId: 'content-b',
  routeChangedAt: 200,
  videoId: 'video-b',
  videoRevision: 2,
};

type ReadyOverview = Extract<SubtitleOverviewResponse, { status: 'ready' }>;
type SuccessfulOverviewMessage = { success: true; data: SubtitleOverviewResponse };
type SuccessfulVideoTimeMessage = { success: true; data: VideoTimeResponse };

describe('useSubtitleOverview', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetConnectedTab();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('loads both active subtitle tracks for the connected tab in one request', async () => {
    harness.sendMessageToTab.mockResolvedValueOnce(successfulOverview(makeReady()));

    await renderHarness(root);

    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.currentTime).toBe('12.5');
    expect(getOutput(container).dataset.learningCues).toBe('Current learning cue');
    expect(getOutput(container).dataset.supportCues).toBe('Current support cue');
    expect(harness.sendMessageToTab).toHaveBeenCalledOnce();
    expect(harness.sendMessageToTab).toHaveBeenCalledWith(17, 'getSubtitleOverview');
  });

  it.each([
    {
      label: 'active tab',
      applyChange: (): void => {
        harness.state.activeTab = {
          id: 18,
          url: 'https://www.coupangplay.com/play/next',
        } as chrome.tabs.Tab;
      },
      expectedTabId: 18,
    },
    {
      label: 'video status',
      applyChange: (): void => {
        harness.state.tabInfo = {
          ...harness.state.tabInfo,
          connectionStatus: 'connected',
          videoStatus: 'not_detected',
        };
      },
      expectedTabId: 17,
    },
    {
      label: 'selected learning subtitle',
      applyChange: (): void => {
        harness.state.tabInfo = {
          ...harness.state.tabInfo,
          connectionStatus: 'connected',
          learningSubtitleId: 'learning-2',
        };
      },
      expectedTabId: 17,
    },
    {
      label: 'selected support subtitle',
      applyChange: (): void => {
        harness.state.tabInfo = {
          ...harness.state.tabInfo,
          connectionStatus: 'connected',
          supportSubtitleId: 'support-2',
        };
      },
      expectedTabId: 17,
    },
  ])('discards a late snapshot after the $label changes', async ({
    applyChange,
    expectedTabId,
  }) => {
    const oldSnapshot = deferred<SuccessfulOverviewMessage>();
    const currentSnapshot = deferred<SuccessfulOverviewMessage>();
    harness.sendMessageToTab
      .mockReturnValueOnce(oldSnapshot.promise)
      .mockReturnValueOnce(currentSnapshot.promise);

    await renderHarness(root);
    expect(getOutput(container).dataset.status).toBe('loading');

    applyChange();
    await renderHarness(root);
    expect(getOutput(container).dataset.status).toBe('loading');
    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(
      2,
      expectedTabId,
      'getSubtitleOverview'
    );

    await act(async () => {
      oldSnapshot.resolve(successfulOverview(makeReady({ identity: IDENTITY_A })));
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.status).toBe('loading');

    await act(async () => {
      currentSnapshot.resolve(successfulOverview(makeReady({ identity: IDENTITY_B })));
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.identity).toBe('content-b');
  });

  it('polls 500ms after each response settles without overlapping requests', async () => {
    const firstPoll = deferred<SuccessfulVideoTimeMessage>();
    const secondPoll = deferred<SuccessfulVideoTimeMessage>();
    harness.sendMessageToTab
      .mockResolvedValueOnce(successfulOverview(makeReady({ identity: IDENTITY_A })))
      .mockReturnValueOnce(firstPoll.promise)
      .mockReturnValueOnce(secondPoll.promise);

    await renderHarness(root);
    expect(harness.sendMessageToTab).toHaveBeenCalledTimes(1);

    await advanceTimers(499);
    expect(harness.sendMessageToTab).toHaveBeenCalledTimes(1);

    await advanceTimers(1);
    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(2, 17, 'getVideoTime');

    await advanceTimers(5_000);
    expect(harness.sendMessageToTab).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstPoll.resolve(successfulVideoTime(IDENTITY_A, 13));
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.currentTime).toBe('13');

    await advanceTimers(499);
    expect(harness.sendMessageToTab).toHaveBeenCalledTimes(2);

    await advanceTimers(1);
    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(3, 17, 'getVideoTime');
  });

  it('marks an identity mismatch stale and automatically reloads the snapshot', async () => {
    const mismatchedPoll = deferred<SuccessfulVideoTimeMessage>();
    const refreshedSnapshot = deferred<SuccessfulOverviewMessage>();
    harness.sendMessageToTab
      .mockResolvedValueOnce(successfulOverview(makeReady({ identity: IDENTITY_A })))
      .mockReturnValueOnce(mismatchedPoll.promise)
      .mockReturnValueOnce(refreshedSnapshot.promise);

    await renderHarness(root);
    await advanceTimers(500);

    await act(async () => {
      mismatchedPoll.resolve(successfulVideoTime(IDENTITY_B, 24));
      await flushMicrotasks();
    });

    expect(getOutput(container).dataset.status).toBe('stale');
    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(3, 17, 'getSubtitleOverview');

    await act(async () => {
      refreshedSnapshot.resolve(successfulOverview(makeReady({ identity: IDENTITY_B })));
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.identity).toBe('content-b');
  });

  it('reloads late native cues when the subtitle revision changes', async () => {
    harness.state.playbackContext = null;
    const revisedPoll = deferred<SuccessfulVideoTimeMessage>();
    const refreshedSnapshot = deferred<SuccessfulOverviewMessage>();
    harness.sendMessageToTab
      .mockResolvedValueOnce(
        successfulOverview(makeReady({ identity: IDENTITY_A, subtitleRevision: 1 }))
      )
      .mockReturnValueOnce(revisedPoll.promise)
      .mockReturnValueOnce(refreshedSnapshot.promise);

    await renderHarness(root);
    await advanceTimers(500);

    await act(async () => {
      revisedPoll.resolve(successfulVideoTime(IDENTITY_A, 24, 2));
      await flushMicrotasks();
    });

    expect(getOutput(container).dataset.status).toBe('stale');
    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(3, 17, 'getSubtitleOverview');

    await act(async () => {
      refreshedSnapshot.resolve(
        successfulOverview(
          makeReady({
            identity: IDENTITY_A,
            subtitleRevision: 2,
            learningCues: [
              { sourceIndex: 0, startTime: 12, endTime: 13, text: 'Current cue' },
              { sourceIndex: 1, startTime: 14, endTime: 15, text: 'Late native cue' },
            ],
          })
        )
      );
      await flushMicrotasks();
    });

    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.subtitleRevision).toBe('2');
    expect(getOutput(container).dataset.learningCues).toBe('Current cue|Late native cue');
  });

  it('reloads a published subtitle revision without waiting for the video-time poll', async () => {
    const refreshedSnapshot = deferred<SuccessfulOverviewMessage>();
    harness.sendMessageToTab
      .mockResolvedValueOnce(successfulOverview(makeReady({ subtitleRevision: 1 })))
      .mockReturnValueOnce(refreshedSnapshot.promise);

    await renderHarness(root);
    expect(getOutput(container).dataset.status).toBe('ready');

    harness.state.playbackContext = makePlaybackContext(2);
    await renderHarness(root);

    expect(getOutput(container).dataset.status).not.toBe('ready');
    expect(getOutput(container).dataset.learningCues).toBeUndefined();
    expect(harness.sendMessageToTab).toHaveBeenCalledTimes(2);
    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(2, 17, 'getSubtitleOverview');

    await act(async () => {
      refreshedSnapshot.resolve(successfulOverview(makeReady({ subtitleRevision: 2 })));
      await flushMicrotasks();
    });

    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.subtitleRevision).toBe('2');
  });

  it('discards a late subtitle snapshot after the published revision changes', async () => {
    const oldSnapshot = deferred<SuccessfulOverviewMessage>();
    const currentSnapshot = deferred<SuccessfulOverviewMessage>();
    harness.sendMessageToTab
      .mockReturnValueOnce(oldSnapshot.promise)
      .mockReturnValueOnce(currentSnapshot.promise);

    await renderHarness(root);
    harness.state.playbackContext = makePlaybackContext(2);
    await renderHarness(root);

    await act(async () => {
      oldSnapshot.resolve(successfulOverview(makeReady({ subtitleRevision: 1 })));
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.status).not.toBe('ready');

    await act(async () => {
      currentSnapshot.resolve(successfulOverview(makeReady({ subtitleRevision: 2 })));
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.subtitleRevision).toBe('2');
  });

  it('cleans up a scheduled poll when the tab disconnects', async () => {
    harness.sendMessageToTab.mockResolvedValueOnce(successfulOverview(makeReady()));

    await renderHarness(root);
    harness.state.tabInfo = {
      ...harness.state.tabInfo,
      connectionStatus: 'disconnected',
    };
    await renderHarness(root);

    expect(getOutput(container).dataset.status).toBe('disconnected');
    await advanceTimers(5_000);
    expect(harness.sendMessageToTab).toHaveBeenCalledOnce();
  });

  it('reloads a no-video snapshot when the same connected tab detects video', async () => {
    harness.state.tabInfo = {
      ...harness.state.tabInfo,
      connectionStatus: 'connected',
      videoStatus: 'not_detected',
    };
    harness.sendMessageToTab
      .mockResolvedValueOnce(successfulOverview({ status: 'no-video', identity: IDENTITY_A }))
      .mockResolvedValueOnce(successfulOverview(makeReady()));

    await renderHarness(root);
    expect(getOutput(container).dataset.status).toBe('no-video');
    expect(harness.sendMessageToTab).toHaveBeenCalledOnce();

    harness.state.tabInfo = {
      ...harness.state.tabInfo,
      connectionStatus: 'connected',
      videoStatus: 'detected',
    };
    await renderHarness(root);

    expect(harness.sendMessageToTab).toHaveBeenNthCalledWith(2, 17, 'getSubtitleOverview');
    expect(getOutput(container).dataset.status).toBe('ready');
  });

  it('stops polling after a video-time request fails', async () => {
    harness.sendMessageToTab
      .mockResolvedValueOnce(successfulOverview(makeReady()))
      .mockRejectedValueOnce(new Error('Content request failed'));

    await renderHarness(root);
    await advanceTimers(500);

    expect(getOutput(container).dataset.status).toBe('error');
    await advanceTimers(5_000);
    expect(harness.sendMessageToTab).toHaveBeenCalledTimes(2);
  });
});

const HookHarness = () => {
  const { viewState } = useSubtitleOverview();
  const snapshot = viewState.status === 'ready' ? viewState.snapshot : undefined;
  return (
    <output
      data-current-time={snapshot?.currentTime}
      data-identity={snapshot?.identity.contentInstanceId}
      data-learning-cues={snapshot?.tracks.learning.cues.map(({ text }) => text).join('|')}
      data-status={viewState.status}
      data-subtitle-revision={snapshot?.subtitleRevision}
      data-support-cues={snapshot?.tracks.support?.cues.map(({ text }) => text).join('|') ?? ''}
    />
  );
};

const renderHarness = async (root: Root) => {
  await act(async () => {
    root.render(<HookHarness />);
    await flushMicrotasks();
  });
};

const advanceTimers = async (milliseconds: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

const getOutput = (container: ParentNode) => {
  const output = container.querySelector<HTMLOutputElement>('output');
  if (!output) throw new Error('Expected hook output');
  return output;
};

const resetConnectedTab = () => {
  harness.state.activeTab = {
    id: 17,
    url: 'https://www.coupangplay.com/play/current',
  } as chrome.tabs.Tab;
  harness.state.tabInfo = {
    connectionStatus: 'connected',
    learningSubtitleId: 'learning-1',
    supportSubtitleId: 'support-1',
    videoStatus: 'detected',
  };
  harness.state.playbackContext = makePlaybackContext(1);
};

const makePlaybackContext = (subtitleRevision: number): PlaybackContextStatus => ({
  contentEpoch: IDENTITY_A.contentEpoch,
  contentInstanceId: IDENTITY_A.contentInstanceId,
  learningAvailable: true,
  lifecycle: 'content',
  mediaAttachmentRevision: IDENTITY_A.videoRevision,
  missionResumeRequired: false,
  routeChangedAt: IDENTITY_A.routeChangedAt,
  routeKind: 'episode',
  subtitleIdentity: {
    learning: 'native:en',
    subtitleRevision,
    support: 'native:ko',
  },
  videoId: IDENTITY_A.videoId,
  videoRevision: IDENTITY_A.videoRevision,
});

interface ReadyOptions {
  identity?: ContentVideoIdentity;
  subtitleRevision?: number;
  learningCues?: SubtitleOverviewCue[];
  supportCues?: SubtitleOverviewCue[] | null;
}

const makeReady = ({
  identity = IDENTITY_A,
  subtitleRevision = 1,
  learningCues = [
    { sourceIndex: 0, startTime: 12, endTime: 13, text: 'Current learning cue' },
  ],
  supportCues = [
    { sourceIndex: 0, startTime: 12, endTime: 13, text: 'Current support cue' },
  ],
}: ReadyOptions = {}): ReadyOverview => ({
  status: 'ready',
  identity,
  subtitleRevision,
  currentTime: 12.5,
  tracks: {
    learning: {
      role: 'learning',
      language: 'en',
      source: {
        kind: 'registered',
        language: 'en',
        subtitleId: 'learning-1',
        delaySeconds: 0,
      },
      cues: learningCues,
    },
    support:
      supportCues === null
        ? null
        : {
            role: 'support',
            language: 'ko',
            source: {
              kind: 'registered',
              language: 'ko',
              subtitleId: 'support-1',
              delaySeconds: 0,
            },
            cues: supportCues,
          },
  },
});

const successfulOverview = (data: SubtitleOverviewResponse): SuccessfulOverviewMessage => ({
  success: true,
  data,
});

const successfulVideoTime = (
  identity: ContentVideoIdentity,
  currentTime: number,
  subtitleRevision = 1
): SuccessfulVideoTimeMessage => ({
  success: true,
  data: { status: 'ready', identity, subtitleRevision, currentTime },
});

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
