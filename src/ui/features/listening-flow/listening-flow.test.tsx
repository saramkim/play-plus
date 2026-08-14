import { act } from 'react';

import { listeningSegmentKeySchema } from '@storage/v2/schema';
import type { ListeningProgressV1 } from '@storage/v2/type';
import type { BeginListeningSessionResponse } from '@utils/message/type';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

import type {
  ListeningMissionTransport,
  ListeningSessionController,
  ListeningSessionFatalReason,
} from '@/ui/adapters/listening-mission-controller';
import type { LearningSettingsStore } from '@/ui/features/learning-settings/learning-settings-store';
import type { ListeningMissionProps } from '@/ui/features/listening-mission/listening-mission';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

const harness = vi.hoisted(() => ({
  missionProps: undefined as ListeningMissionProps | undefined,
  settingsRenders: 0,
}));

vi.mock('@/ui/features/listening-mission/listening-mission', () => ({
  ListeningMission: (props: ListeningMissionProps) => {
    harness.missionProps = props;
    return <div data-testid='active-mission'>{props.snapshot.segments[0].answerText}</div>;
  },
}));
vi.mock('@/ui/pages/learning-settings-page', () => ({
  LearningSettingsPage: () => {
    harness.settingsRenders += 1;
    return <div data-testid='learning-settings'>settings</div>;
  },
}));

import { ListeningLearningPage } from './listening-flow';

describe('Listening Learning production flow', () => {
  let container: HTMLDivElement;
  let controller: ListeningSessionController;
  let fatalCallback: ((reason: ListeningSessionFatalReason) => void) | undefined;
  let root: Root;
  let rootMounted: boolean;
  let transport: ListeningMissionTransport;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    harness.missionProps = undefined;
    harness.settingsRenders = 0;
    usePageStore.setState({
      currentPage: 'learning',
      navigationLocked: false,
      navigationLockTokens: new Set(),
    });
    useTabStore.setState({
      activeTab: { id: 17 } as chrome.tabs.Tab,
      playbackContext: PLAYBACK_CONTEXT,
      tabInfo: { connectionStatus: 'connected', videoStatus: 'detected' },
    });
    SETTINGS_STORE.setState({
      learningProfile: { learningLanguage: 'en', supportLanguage: 'ko' },
    });
    controller = createController();
    transport = {
      beginSession: vi.fn().mockResolvedValue(READY_SESSION),
      clearAllProgress: vi.fn().mockResolvedValue(EMPTY_PROGRESS),
      clearVideoProgress: vi.fn().mockResolvedValue(EMPTY_PROGRESS),
      createSessionController: vi.fn((_session, onFatal) => {
        fatalCallback = onFatal;
        return controller;
      }),
      getCatalog: vi.fn().mockResolvedValue(CATALOG),
      getProgress: vi.fn().mockResolvedValue(EMPTY_PROGRESS),
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    rootMounted = true;
  });

  afterEach(() => {
    if (rootMounted) act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('does not send direct messages until the active content connection is exact', async () => {
    useTabStore.setState({ tabInfo: { connectionStatus: 'disconnected' } });
    const factory = vi.fn(() => transport);
    await renderFlow(factory);

    expect(container.textContent).toContain('v2_listening_landing_disconnected_title');
    expect(factory).not.toHaveBeenCalled();
    expect(transport.getCatalog).not.toHaveBeenCalled();

    act(() => useTabStore.setState({ tabInfo: { connectionStatus: 'connecting' } }));
    expect(container.textContent).toContain('v2_listening_landing_connecting_title');
    expect(factory).not.toHaveBeenCalled();

    await act(async () => {
      useTabStore.setState({ tabInfo: { connectionStatus: 'connected' } });
      await flush();
    });
    expect(factory).toHaveBeenCalledWith(17);
    expect(container.textContent).toContain('v2_listening_landing_continue');
  });

  it.each([
    ['no-video', 'v2_listening_landing_no_video_title'],
    ['video-identity-unavailable', 'v2_listening_landing_video_identity_unavailable_title'],
    ['no-learning-track', 'v2_listening_landing_no_learning_track_title'],
    ['no-segments', 'v2_listening_landing_no_segments_title'],
    ['error', 'v2_listening_landing_error_title'],
  ] as const)('renders the truthful %s landing state', async (status, expectedKey) => {
    vi.mocked(transport.getCatalog).mockResolvedValueOnce({ status });
    await renderFlow();

    expect(container.textContent).toContain(expectedKey);
    expect(container.querySelector("[data-testid='learning-settings']")).not.toBeNull();
  });

  it('reloads an idle native catalog when the selected learning language changes', async () => {
    vi.mocked(transport.getCatalog)
      .mockResolvedValueOnce(CATALOG)
      .mockResolvedValueOnce({ status: 'no-learning-track' });
    await renderFlow();

    await act(async () => {
      SETTINGS_STORE.setState({
        learningProfile: { learningLanguage: 'ja', supportLanguage: 'ko' },
      });
      await flush();
    });

    expect(transport.getCatalog).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('v2_listening_landing_no_learning_track_title');
  });

  it('reloads truth through same-tab video detection and replacement transitions', async () => {
    useTabStore.setState({
      tabInfo: { connectionStatus: 'connected', videoStatus: 'not_detected' },
    });
    vi.mocked(transport.getCatalog)
      .mockResolvedValueOnce({ status: 'no-video' })
      .mockResolvedValueOnce({ status: 'no-video' })
      .mockResolvedValueOnce(CATALOG)
      .mockResolvedValueOnce({ status: 'no-video' })
      .mockResolvedValueOnce({ status: 'no-segments' });
    await renderFlow();
    expect(container.textContent).toContain('v2_listening_landing_no_video_title');

    await setVideoStatus('detecting');
    expect(container.textContent).toContain('v2_listening_landing_no_video_title');
    await setVideoStatus('detected');
    expect(container.textContent).toContain('v2_listening_landing_continue');

    await setVideoStatus('detecting');
    expect(container.textContent).toContain('v2_listening_landing_no_video_title');
    await setVideoStatus('detected');
    expect(container.textContent).toContain('v2_listening_landing_no_segments_title');
    expect(transport.getCatalog).toHaveBeenCalledTimes(5);
  });

  it('selects current/Continue keys, locks pending begin, and preserves one stable ownership callback', async () => {
    const beginPending = deferred<BeginListeningSessionResponse>();
    vi.mocked(transport.beginSession)
      .mockResolvedValueOnce({ status: 'error' })
      .mockReturnValueOnce(beginPending.promise);
    await renderFlow();

    await act(async () => getButton('v2_listening_landing_start_current').click());
    expect(transport.beginSession).toHaveBeenNthCalledWith(
      1,
      CATALOG,
      SEGMENT_KEYS.slice(5, 12)
    );
    expect(usePageStore.getState().navigationLocked).toBe(false);

    await act(async () => {
      getButton('v2_listening_landing_continue').click();
      await flush();
    });
    expect(usePageStore.getState().navigationLocked).toBe(true);
    expect(getButton('v2_listening_landing_start_current').disabled).toBe(true);
    expect(transport.beginSession).toHaveBeenNthCalledWith(2, CATALOG, SEGMENT_KEYS.slice(0, 10));

    await act(async () => beginPending.resolve(READY_SESSION));
    expect(container.querySelector("[data-testid='active-mission']")?.textContent).toBe('fixture line 0');
    expect(container.querySelector("[data-testid='learning-settings']")).toBeNull();
    const ownershipCallback = harness.missionProps?.onOwnershipChange;
    if (!ownershipCallback) throw new Error('Expected mission ownership callback');
    act(() => ownershipCallback(true));
    expect(controller.startHeartbeat).toHaveBeenCalledOnce();

    await act(async () => {
      root.render(<ListeningLearningPage progressRevision={1} settingsStore={SETTINGS_STORE} transportFactory={() => transport} />);
      await flush();
    });
    expect(harness.missionProps?.onOwnershipChange).toBe(ownershipCallback);
    expect(transport.getCatalog).toHaveBeenCalledTimes(3);

    act(() => {
      ownershipCallback(false);
      harness.missionProps?.onExit();
    });
    expect(controller.stopHeartbeat).toHaveBeenCalledOnce();
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('replaces stale ready facts when a fresh start reports unavailable content', async () => {
    vi.mocked(transport.getCatalog)
      .mockResolvedValueOnce(CATALOG)
      .mockResolvedValueOnce({ status: 'no-video' });
    await renderFlow();

    await act(async () => getButton('v2_listening_landing_continue').click());

    expect(container.textContent).toContain('v2_listening_landing_no_video_title');
    expect(container.textContent).not.toContain('v2_listening_landing_continue');
    expect(transport.beginSession).not.toHaveBeenCalled();
  });

  it('replaces stale ready facts when fresh progress cannot be read', async () => {
    vi.mocked(transport.getProgress)
      .mockResolvedValueOnce(EMPTY_PROGRESS)
      .mockRejectedValueOnce(new Error('progress unavailable'));
    await renderFlow();

    await act(async () => getButton('v2_listening_landing_continue').click());

    expect(container.textContent).toContain('v2_listening_landing_error_title');
    expect(container.textContent).not.toContain('v2_listening_landing_continue');
    expect(transport.beginSession).not.toHaveBeenCalled();
  });

  it('keeps fresh after-tail truth and disables Current Position without beginning', async () => {
    const afterTailCatalog = {
      ...CATALOG,
      currentTime: 20,
      segments: CATALOG.segments.slice(0, 3),
    } as const;
    vi.mocked(transport.getCatalog)
      .mockResolvedValueOnce(CATALOG)
      .mockResolvedValueOnce(afterTailCatalog);
    await renderFlow();

    await act(async () => getButton('v2_listening_landing_start_current').click());

    expect(transport.beginSession).not.toHaveBeenCalled();
    expect(container.textContent).toContain('v2_listening_landing_current_unavailable');
    expect(container.textContent).toContain('0 / 3');
    expect(getButton('v2_listening_landing_start_current').disabled).toBe(true);
  });

  it('blocks reset while a stale fresh-catalog selection is pending', async () => {
    const freshCatalog = deferred<Awaited<ReturnType<ListeningMissionTransport['getCatalog']>>>();
    vi.mocked(transport.getCatalog)
      .mockResolvedValueOnce(CATALOG)
      .mockReturnValueOnce(freshCatalog.promise)
      .mockResolvedValue(CATALOG);
    await renderFlow();

    await act(async () => {
      getButton('v2_listening_landing_continue').click();
      await flush();
    });
    const resetVideo = getButton('v2_listening_landing_reset_video');
    expect(resetVideo.disabled).toBe(true);
    act(() => resetVideo.click());
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();

    await act(async () => {
      SETTINGS_STORE.setState({
        learningProfile: { learningLanguage: 'ja', supportLanguage: 'ko' },
      });
      await flush();
    });
    act(() => freshCatalog.resolve(CATALOG));
    await act(async () => await flush());

    expect(transport.beginSession).not.toHaveBeenCalled();
    expect(transport.clearVideoProgress).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='active-mission']")).toBeNull();
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('cleans an abandoned late begin response after a selected language changes', async () => {
    const beginPending = deferred<BeginListeningSessionResponse>();
    const disposal = deferred<void>();
    vi.mocked(transport.beginSession).mockReturnValueOnce(beginPending.promise);
    vi.mocked(controller.dispose).mockReturnValueOnce(disposal.promise);
    await renderFlow();
    await act(async () => {
      getButton('v2_listening_landing_continue').click();
      await flush();
    });

    await act(async () => {
      SETTINGS_STORE.setState({
        learningProfile: { learningLanguage: 'ja', supportLanguage: 'ko' },
      });
      await flush();
    });
    expect(usePageStore.getState().navigationLocked).toBe(true);
    expect(container.textContent).toContain('v2_listening_landing_starting');
    expect(getButton('v2_listening_landing_start_current').disabled).toBe(true);
    const resetVideo = getButton('v2_listening_landing_reset_video');
    expect(resetVideo.disabled).toBe(true);
    act(() => resetVideo.click());
    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(transport.clearVideoProgress).not.toHaveBeenCalled();

    act(() => beginPending.resolve(READY_SESSION));
    await act(async () => await flush());

    expect(controller.dispose).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain('fixture line 0');
    expect(usePageStore.getState().navigationLocked).toBe(true);

    await act(async () => {
      disposal.resolve();
      await flush();
    });
    expect(usePageStore.getState().navigationLocked).toBe(false);
    expect(container.textContent).not.toContain('v2_listening_landing_starting');
  });

  it('keeps a pending begin lock through unmount until late ready disposal settles', async () => {
    const beginPending = deferred<BeginListeningSessionResponse>();
    const disposal = deferred<void>();
    vi.mocked(transport.beginSession).mockReturnValueOnce(beginPending.promise);
    vi.mocked(controller.dispose).mockReturnValueOnce(disposal.promise);
    await renderFlow();
    await act(async () => {
      getButton('v2_listening_landing_continue').click();
      await flush();
    });
    expect(usePageStore.getState().navigationLocked).toBe(true);

    act(() => root.unmount());
    rootMounted = false;
    expect(usePageStore.getState().navigationLocked).toBe(true);

    act(() => beginPending.resolve(READY_SESSION));
    await act(async () => await flush());
    expect(controller.dispose).toHaveBeenCalledOnce();
    expect(usePageStore.getState().navigationLocked).toBe(true);

    await act(async () => {
      disposal.resolve();
      await flush();
    });
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('ignores a late catalog after the selected source context changes', async () => {
    const oldCatalog = deferred<Awaited<ReturnType<ListeningMissionTransport['getCatalog']>>>();
    vi.mocked(transport.getCatalog)
      .mockReturnValueOnce(oldCatalog.promise)
      .mockResolvedValueOnce({ status: 'no-video' });
    act(() => {
      root.render(<ListeningLearningPage progressRevision={0} settingsStore={SETTINGS_STORE} transportFactory={() => transport} />);
    });
    await act(async () => await flush());
    await act(async () => {
      useTabStore.setState({
        tabInfo: { connectionStatus: 'connected', learningSubtitleId: 'subtitle-new' },
      });
      await flush();
    });
    await act(async () => oldCatalog.resolve(CATALOG));

    expect(container.textContent).toContain('v2_listening_landing_no_video_title');
    expect(container.textContent).not.toContain('v2_listening_landing_continue');
  });

  it('reloads landing truth after a stale begin and clears the pending UI', async () => {
    vi.mocked(transport.getCatalog)
      .mockResolvedValueOnce(CATALOG)
      .mockResolvedValueOnce(CATALOG)
      .mockResolvedValueOnce({ status: 'no-segments' });
    vi.mocked(transport.beginSession).mockResolvedValueOnce({ status: 'stale' });
    await renderFlow();

    await act(async () => {
      getButton('v2_listening_landing_continue').click();
      await flush();
    });

    expect(container.textContent).toContain('v2_listening_landing_no_segments_title');
    expect(container.textContent).not.toContain('v2_listening_landing_starting');
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('keeps text, settings, and navigation locked behind retryable fatal teardown', async () => {
    vi.mocked(controller.endSession)
      .mockResolvedValueOnce({ status: 'error' })
      .mockResolvedValueOnce({ status: 'ended' });
    await startReadyMission();
    const ownershipCallback = harness.missionProps?.onOwnershipChange;
    if (!ownershipCallback || !fatalCallback) throw new Error('Expected active mission callbacks');
    act(() => ownershipCallback(true));

    await act(async () => fatalCallback?.('error'));
    expect(container.textContent).not.toContain('fixture line 0');
    expect(container.querySelector("[data-testid='learning-settings']")).toBeNull();
    expect(container.textContent).toContain('v2_listening_mission_retry_ending');
    expect(document.activeElement).toBe(getButton('v2_listening_mission_retry_ending'));
    expect(usePageStore.getState().navigationLocked).toBe(true);
    expect(controller.endSession).toHaveBeenNthCalledWith(1, 'restore-start');

    await act(async () => getButton('v2_listening_mission_retry_ending').click());
    expect(controller.endSession).toHaveBeenNthCalledWith(2, 'restore-start');
    expect(usePageStore.getState().navigationLocked).toBe(false);
    expect(container.querySelector("[data-testid='learning-settings']")).not.toBeNull();
    expect(container.textContent).toContain('v2_listening_landing_fatal_title');
  });

  it('uses separate reset confirmations, preserves UI on failure, and restores focus', async () => {
    vi.mocked(transport.clearAllProgress)
      .mockRejectedValueOnce(new Error('write failed'))
      .mockResolvedValueOnce(EMPTY_PROGRESS);
    await renderFlow();

    const videoReset = getButton('v2_listening_landing_reset_video');
    act(() => videoReset.click());
    expect(container.textContent).toContain('v2_listening_landing_reset_video_confirm_description');
    const dialog = container.querySelector<HTMLElement>('[role="alertdialog"]');
    if (!dialog) throw new Error('Expected reset confirmation dialog');
    const videoConfirm = getButton('v2_listening_landing_reset_video_confirm');
    expect(document.activeElement).toBe(videoConfirm);
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' })));
    expect(document.activeElement).toBe(getButton('cancel'));
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true })));
    expect(document.activeElement).toBe(videoConfirm);
    act(() => dialog.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    await act(async () => await flushAnimationFrame());
    expect(document.activeElement).toBe(videoReset);

    act(() => getButton('v2_listening_landing_reset_all').click());
    await act(async () => getButton('v2_listening_landing_reset_all_confirm').click());
    expect(container.textContent).toContain('v2_listening_landing_reset_error');
    expect(transport.clearVideoProgress).not.toHaveBeenCalled();
    expect(transport.clearAllProgress).toHaveBeenCalledOnce();

    await act(async () => getButton('v2_listening_landing_reset_all_confirm').click());
    expect(transport.clearAllProgress).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('v2_listening_landing_reset_all_success');
    await act(async () => await flushAnimationFrame());
    expect(document.activeElement).toBe(getButton('v2_listening_landing_reset_all'));
  });

  it('blocks every start path while a reset dialog or reset write is pending', async () => {
    const clearing = deferred<ListeningProgressV1>();
    vi.mocked(transport.clearAllProgress).mockReturnValueOnce(clearing.promise);
    await renderFlow();

    act(() => getButton('v2_listening_landing_reset_all').click());
    const continueButton = getButton('v2_listening_landing_continue');
    const currentButton = getButton('v2_listening_landing_start_current');
    expect(continueButton.disabled).toBe(true);
    expect(currentButton.disabled).toBe(true);
    act(() => {
      continueButton.click();
      currentButton.click();
    });
    expect(transport.beginSession).not.toHaveBeenCalled();

    act(() => getButton('v2_listening_landing_reset_all_confirm').click());
    await act(async () => await flush());
    expect(getButton('v2_listening_landing_resetting').disabled).toBe(true);
    expect(getButton('v2_listening_landing_continue').disabled).toBe(true);
    expect(transport.beginSession).not.toHaveBeenCalled();

    await act(async () => {
      clearing.resolve(EMPTY_PROGRESS);
      await flush();
    });
    expect(transport.clearAllProgress).toHaveBeenCalledOnce();
    expect(transport.beginSession).not.toHaveBeenCalled();
  });

  it('cancels an open video reset when its exact tab/source context changes', async () => {
    await renderFlow();
    act(() => getButton('v2_listening_landing_reset_video').click());
    expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

    await act(async () => {
      useTabStore.setState({
        tabInfo: { connectionStatus: 'connected', learningSubtitleId: 'subtitle-new' },
      });
      await flush();
    });
    await act(async () => await flushAnimationFrame());

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(transport.clearVideoProgress).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(getButton('v2_listening_landing_reset_video'));
  });

  it('does not let an open video reset reappear for a newly loaded video', async () => {
    await renderFlow();
    act(() => getButton('v2_listening_landing_reset_video').click());
    vi.mocked(transport.getCatalog).mockResolvedValueOnce({
      ...CATALOG,
      identity: { ...CATALOG.identity, videoId: 'video-b', videoRevision: 3 },
      videoId: 'video-b',
    });

    await act(async () => {
      root.render(<ListeningLearningPage progressRevision={1} settingsStore={SETTINGS_STORE} transportFactory={() => transport} />);
      await flush();
    });

    expect(container.querySelector('[role="alertdialog"]')).toBeNull();
    expect(transport.clearVideoProgress).not.toHaveBeenCalled();
    expect(container.textContent).toContain('v2_listening_landing_continue');
  });

  it('refreshes Next 10 from content and starts after the prior final key', async () => {
    await startReadyMission();
    const ownershipCallback = harness.missionProps?.onOwnershipChange;
    if (!ownershipCallback) throw new Error('Expected active mission ownership');
    act(() => {
      ownershipCallback(false);
      harness.missionProps?.onNextMission();
    });
    await act(async () => await flush());

    expect(transport.getCatalog).toHaveBeenCalledTimes(3);
    expect(transport.beginSession).toHaveBeenNthCalledWith(2, CATALOG, SEGMENT_KEYS.slice(10, 12));
  });

  it('returns to refreshed landing truth when Next 10 is already at the catalog tail', async () => {
    await startReadyMission();
    vi.mocked(transport.getCatalog).mockResolvedValueOnce({
      ...CATALOG,
      segments: CATALOG.segments.slice(0, 10),
    });
    const ownershipCallback = harness.missionProps?.onOwnershipChange;
    if (!ownershipCallback) throw new Error('Expected active mission ownership');

    act(() => {
      ownershipCallback(false);
      harness.missionProps?.onNextMission();
    });
    await act(async () => await flush());

    expect(transport.beginSession).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-testid='learning-settings']")).not.toBeNull();
    expect(container.textContent).toContain('0 / 10');
    expect(container.textContent).toContain('v2_listening_landing_continue');
    expect(container.textContent).not.toContain('v2_listening_landing_starting');
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('keeps refreshed landing truth visible when the Next 10 begin fails', async () => {
    await startReadyMission();
    vi.mocked(transport.beginSession).mockResolvedValueOnce({ status: 'error' });
    const ownershipCallback = harness.missionProps?.onOwnershipChange;
    if (!ownershipCallback) throw new Error('Expected active mission ownership');

    act(() => {
      ownershipCallback(false);
      harness.missionProps?.onNextMission();
    });
    await act(async () => await flush());

    expect(transport.beginSession).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('v2_listening_landing_start_error');
    expect(container.textContent).toContain('v2_listening_landing_continue');
    expect(container.textContent).not.toContain('v2_listening_landing_loading');
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('keeps navigation locked until delayed unmount restoration settles', async () => {
    const disposal = deferred<void>();
    vi.mocked(controller.dispose).mockReturnValueOnce(disposal.promise);
    await startReadyMission();
    const ownershipCallback = harness.missionProps?.onOwnershipChange;
    if (!ownershipCallback) throw new Error('Expected active mission ownership');
    act(() => ownershipCallback(true));
    expect(usePageStore.getState().navigationLocked).toBe(true);

    act(() => root.unmount());
    rootMounted = false;
    expect(usePageStore.getState().navigationLocked).toBe(true);
    expect(controller.dispose).toHaveBeenCalledOnce();

    await act(async () => disposal.resolve());
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it('keeps the mission hidden through an ad and requires explicit same-content resume', async () => {
    await startReadyMission();
    const interrupted = {
      ...PLAYBACK_CONTEXT,
      learningAvailable: false,
      lifecycle: 'advertisement' as const,
      mediaAttachmentRevision: PLAYBACK_CONTEXT.videoRevision + 1,
      missionResumeRequired: true,
      videoRevision: PLAYBACK_CONTEXT.videoRevision + 1,
    };

    await act(async () => {
      useTabStore.setState({ playbackContext: interrupted });
      useTabStore.setState({ playbackContext: interrupted });
      await flush();
    });
    expect(container.textContent).toContain('v2_listening_advertisement_title');
    expect(
      container
        .querySelector("[data-testid='active-mission']")
        ?.parentElement?.hasAttribute('inert')
    ).toBe(true);
    expect(controller.resumeAfterAdvertisement).not.toHaveBeenCalled();

    await act(async () => {
      useTabStore.setState({
        playbackContext: {
          ...interrupted,
          learningAvailable: true,
          lifecycle: 'content',
          mediaAttachmentRevision: interrupted.videoRevision + 1,
          videoRevision: interrupted.videoRevision + 1,
        },
      });
      await flush();
    });
    expect(container.textContent).toContain('v2_listening_advertisement_returned_title');
    await act(async () => getButton('v2_listening_advertisement_continue').click());
    expect(controller.resumeAfterAdvertisement).toHaveBeenCalledOnce();

    await act(async () => {
      useTabStore.setState({
        playbackContext: {
          ...PLAYBACK_CONTEXT,
          mediaAttachmentRevision: PLAYBACK_CONTEXT.videoRevision + 2,
          videoRevision: PLAYBACK_CONTEXT.videoRevision + 2,
        },
      });
      await flush();
    });
    expect(
      container
        .querySelector("[data-testid='active-mission']")
        ?.parentElement?.hasAttribute('inert')
    ).toBe(false);
  });

  it.each([320, 360, 390])('keeps one idle scroll owner at %ipx', async (width) => {
    container.style.width = `${width}px`;
    await renderFlow();
    expect(container.querySelectorAll('[data-scroll-owner]')).toHaveLength(1);
    expect(container.querySelector('[data-scroll-owner="learning"]')?.className).toContain('overflow-x-hidden');
  });

  const renderFlow = async (factory: (tabId: number) => ListeningMissionTransport = () => transport) => {
    await act(async () => {
      root.render(<ListeningLearningPage progressRevision={0} settingsStore={SETTINGS_STORE} transportFactory={factory} />);
      await flush();
    });
  };

  const startReadyMission = async () => {
    await renderFlow();
    await act(async () => getButton('v2_listening_landing_continue').click());
    if (!harness.missionProps) throw new Error('Expected active mission');
  };

  const setVideoStatus = async (videoStatus: 'detected' | 'detecting' | 'not_detected') => {
    await act(async () => {
      useTabStore.setState({ tabInfo: { connectionStatus: 'connected', videoStatus } });
      await flush();
    });
  };

  const getButton = (name: string) => {
    const button = Array.from(container.querySelectorAll('button')).find(
      (candidate) => candidate.textContent?.includes(name) || candidate.getAttribute('aria-label') === name
    );
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Expected button: ${name}`);
    return button;
  };
});

const createController = (): ListeningSessionController => ({
  commitProgress: vi.fn().mockResolvedValue({ status: 'saved' }),
  dispose: vi.fn().mockResolvedValue(undefined),
  endSession: vi.fn().mockResolvedValue({ status: 'ended' }),
  playSegment: vi.fn().mockResolvedValue({ status: 'played' }),
  resumeAfterAdvertisement: vi.fn().mockResolvedValue('resumed'),
  saveDifficultSegments: vi.fn().mockResolvedValue({ retryableFailures: [], saved: [] }),
  sessionId: 'session-a',
  startHeartbeat: vi.fn(),
  stopHeartbeat: vi.fn(),
});

const SEGMENT_KEYS = Array.from({ length: 12 }, (_, index) =>
  listeningSegmentKeySchema.parse(`segment-v1-${index.toString(16).padStart(64, '0')}`)
);

const CATALOG = {
  currentTime: 5.1,
  identity: {
    contentEpoch: 1,
    contentInstanceId: 'content-a',
    routeChangedAt: 1,
    videoId: 'video-a',
    videoRevision: 2,
  },
  segmenterVersion: 1,
  segments: SEGMENT_KEYS.map((segmentKey, index) => ({
    endMs: index * 1000 + 800,
    segmentKey,
    startMs: index * 1000,
  })),
  sourceKey: 'native:en',
  status: 'ready',
  subtitleRevision: 3,
  supportAvailable: true,
  videoId: 'video-a',
} as const;

const PLAYBACK_CONTEXT = {
  ...CATALOG.identity,
  learningAvailable: true,
  lifecycle: 'content',
  mediaAttachmentRevision: CATALOG.identity.videoRevision,
  missionResumeRequired: false,
  routeKind: 'episode',
  subtitleIdentity: {
    learning: CATALOG.sourceKey,
    subtitleRevision: CATALOG.subtitleRevision,
    support: 'native:ko',
  },
} as const;

const READY_SESSION = {
  identity: CATALOG.identity,
  sessionId: 'session-a',
  snapshot: {
    learningLanguage: 'en',
    segmenterVersion: 1,
    segments: SEGMENT_KEYS.slice(0, 10).map((segmentKey, index) => ({
      answerText: `fixture line ${index}`,
      endMs: index * 1000 + 800,
      segmentKey,
      sourceIndices: [index],
      sourceKey: 'native:en' as const,
      startMs: index * 1000,
    })),
    sourceKey: 'native:en',
    videoId: 'video-a',
  },
  status: 'ready',
  subtitleRevision: 3,
} satisfies Extract<BeginListeningSessionResponse, { status: 'ready' }>;

const EMPTY_PROGRESS: ListeningProgressV1 = { version: 1, videos: {} };
const SETTINGS_STORE = create(() => ({
  learningProfile: { learningLanguage: 'en' as const, supportLanguage: 'ko' as const },
})) as unknown as LearningSettingsStore;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const flushAnimationFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
