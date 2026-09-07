import { act } from 'react';

import { listeningSegmentKeySchema } from '@storage/v2/schema';
import type { ListeningProgressV1 } from '@storage/v2/type';
import type { BeginListeningSessionResponse } from '@utils/message/type';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { create } from 'zustand';

import {
  createListeningMissionTransport,
  type ListeningMissionTransport,
  type ListeningTabMessageSender,
  type ListeningRuntimeMessageSender,
} from '@/ui/adapters/listening-mission-controller';
import type { LearningSettingsStore } from '@/ui/features/learning-settings/learning-settings-store';
import { usePageStore } from '@/ui/store/page-store';
import { useTabStore } from '@/ui/store/tab-store';

vi.mock('@/ui/pages/learning-settings-page', () => ({ LearningSettingsPage: () => <div>settings</div> }));

import { ListeningLearningPage } from './listening-flow';

describe('actual listening flow, mission and adapter integration', () => {
  let container: HTMLDivElement;
  let root: Root;
  let transport: ListeningMissionTransport;
  let send: Mock<(tab: number, message: string, params?: unknown) => Promise<unknown>>;
  let runtime: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    usePageStore.setState({ currentPage: 'learning', navigationLocked: false, navigationLockTokens: new Set() });
    useTabStore.setState({
      activeTab: { id: 17 } as chrome.tabs.Tab,
      playbackContext: PLAYBACK_CONTEXT,
      tabInfo: { connectionStatus: 'connected', videoStatus: 'detected' },
    });
    send = vi.fn(async (_tab: number, message: string) => {
      if (message === 'getListeningCatalog') return { success: true, data: CATALOG };
      if (message === 'beginListeningSession') return { success: true, data: READY_SESSION };
      if (message === 'playListeningSegment') return { success: true, data: { status: 'played' } };
      if (message === 'endListeningSession') return { success: true, data: { status: 'already-ended' } };
      if (message === 'heartbeatListeningSession') return { success: true, data: { status: 'alive' } };
      if (message === 'resumeListeningSessionAfterAdvertisement') return {
        success: true, data: { status: 'resumed', identity: { ...CATALOG.identity, videoRevision: 4 }, subtitleRevision: CATALOG.subtitleRevision },
      };
      return { success: true, data: { status: 'saved-learning-only' } };
    });
    runtime = vi.fn().mockResolvedValue({ success: true, data: EMPTY_PROGRESS });
    transport = createListeningMissionTransport(17, {
      sendTabMessage: send as unknown as ListeningTabMessageSender,
      sendRuntimeMessage: runtime as ListeningRuntimeMessageSender,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => { root.unmount(); await flush(); });
    container.remove();
    vi.unstubAllGlobals();
  });
  const button = (label: string) => {
    const node = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
    if (!node) throw new Error('Missing button: ' + label);
    return node;
  };
  const click = async (label: string) => { await act(async () => { button(label).click(); await flush(); }); };
  const start = async () => {
    const factory = () => transport;
    await act(async () => { root.render(<ListeningLearningPage progressRevision={0} settingsStore={SETTINGS_STORE} transportFactory={factory} />); await flush(); });
    await act(async () => (container.querySelector('[data-testid="spoken-language-confirmation"]') as HTMLInputElement).click());
    await click('v2_listening_landing_start_current');
  };
  const type = (draft: string) => {
    const textarea = container.querySelector('textarea')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, draft);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it.each(['stale', 'no-video', 'segment-unavailable'] as const)('tears down terminal %s playback and releases only its navigation token', async (status) => {
    await start();
    await click('v2_listening_reveal');
    expect(container.textContent).toContain('fixture line 4');
    const externalRelease = usePageStore.getState().acquireNavigationLock();
    const end = deferred<{ success: true; data: { status: 'already-ended' } }>();
    const original = send.getMockImplementation()!;
    send.mockImplementation((tab, message, params) => {
      if (message === 'playListeningSegment') return Promise.resolve({ success: true, data: { status } });
      if (message === 'endListeningSession') return end.promise;
      return original(tab, message, params);
    });
    await click('v2_listening_hide_replay');
    expect(container.querySelector('#listening-practice-title')).toBeNull();
    expect(container.textContent).not.toContain('fixture line');
    expect(usePageStore.getState().navigationLockTokens.size).toBe(2);
    await act(async () => end.resolve({ success: true, data: { status: 'already-ended' } }));
    expect(send).toHaveBeenCalledWith(17, 'endListeningSession', { mode: 'restore-start', sessionId: 'session-a' });
    expect(usePageStore.getState().navigationLockTokens.size).toBe(1);
    externalRelease();
    expect(usePageStore.getState().navigationLocked).toBe(false);
  });

  it.each(['stale', 'no-video', 'segment-unavailable'] as const)('tears down terminal %s save without keeping an invalid snapshot', async (status) => {
    await start();
    await click('v2_listening_reveal');
    send.mockResolvedValueOnce({ success: true, data: { status } });
    await click('v2_listening_save_line');
    expect(container.querySelector('#listening-practice-title')).toBeNull();
    expect(container.textContent).not.toContain('fixture line');
    expect(usePageStore.getState().navigationLocked).toBe(false);
    expect(send).toHaveBeenCalledWith(17, 'endListeningSession', { mode: 'restore-start', sessionId: 'session-a' });
    expect(runtime.mock.calls.every(([message]) => message === 'getListeningProgress')).toBe(true);
  });

  it('preserves the same-line draft through ad attachments without hidden autoplay or completion', async () => {
    await start();
    await click('v2_listening_type_optional');
    type('my retained draft');
    const pending = deferred<{ success: true; data: { status: 'played' } }>();
    send.mockReturnValueOnce(pending.promise);
    await click('v2_listening_hide_replay');
    const playCount = send.mock.calls.filter(([, message]) => message === 'playListeningSegment').length;
    const ad = { ...PLAYBACK_CONTEXT, lifecycle: 'advertisement' as const, learningAvailable: false, missionResumeRequired: true, videoRevision: 3, mediaAttachmentRevision: 3 };
    await act(async () => useTabStore.setState({ playbackContext: ad }));
    await act(async () => pending.resolve({ success: true, data: { status: 'played' } }));
    const returned = { ...ad, lifecycle: 'content' as const, learningAvailable: true, videoRevision: 4, mediaAttachmentRevision: 4 };
    await act(async () => useTabStore.setState({ playbackContext: returned }));
    expect(send.mock.calls.filter(([, message]) => message === 'playListeningSegment')).toHaveLength(playCount);
    expect(container.textContent).not.toContain('v2_listening_blind_completed');
    await click('v2_listening_advertisement_continue');
    await act(async () => useTabStore.setState({ playbackContext: { ...returned, missionResumeRequired: false } }));
    expect(send.mock.calls.filter(([, message]) => message === 'playListeningSegment')).toHaveLength(playCount);
    await click('v2_listening_type_optional');
    expect(container.querySelector('textarea')?.value).toBe('my retained draft');
    await click('v2_listening_hide_replay');
    expect(send.mock.calls.filter(([, message]) => message === 'playListeningSegment')).toHaveLength(playCount + 1);
  });
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
    segments: SEGMENT_KEYS.slice(0, 5).map((segmentKey, index) => ({
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
