import { act } from 'react';

import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  currentPage: 'library' as 'learning' | 'subtitles' | 'library' | 'review',
  firstEntryComplete: undefined as (() => void | Promise<void>) | undefined,
  localListener: undefined as
    | ((changes: Record<string, chrome.storage.StorageChange>) => void)
    | undefined,
  learningCardStorage: {},
  openOriginalVideo: undefined as
    | ((source: { startTime: number; url: string }) => Promise<void>)
    | undefined,
  sendMessage: vi.fn(),
  subtitlePageProps: undefined as
    | { cardRevision: number; learningCardStorage: unknown }
    | undefined,
  setPage: vi.fn(),
  settingsInitialize: vi.fn(),
  settingsRemove: vi.fn(),
  tabInitialize: vi.fn(),
  tabRemove: vi.fn(),
}));

vi.mock('@storage/v2/sync-storage', () => ({ createV2SyncStorage: vi.fn(() => ({})) }));
vi.mock('@utils/message', () => ({ sendMessage: harness.sendMessage }));
vi.mock('@/ui/adapters/v2-learning-card-storage', () => ({
  createMessageLearningCardStorage: vi.fn(() => harness.learningCardStorage),
}));
vi.mock('@/ui/features/first-entry/first-entry', () => ({
  V2_ONBOARDING_COMPLETE_KEY: 'v2OnboardingComplete',
  FirstEntry: ({ onComplete }: { onComplete: () => void | Promise<void> }) => {
    harness.firstEntryComplete = onComplete;
    return <div data-testid='first-entry'>first-entry</div>;
  },
}));
vi.mock('@/ui/features/learning-settings/learning-settings-store', () => ({
  createLearningSettingsStore: () => {
    const state = {
      learningProfile: { learningLanguage: 'en', supportLanguage: 'ko' },
      initialize: harness.settingsInitialize,
    };
    const store = (selector: (value: typeof state) => unknown) => selector(state);
    store.getState = () => state;
    return store;
  },
}));
vi.mock('@/ui/features/learning-library/learning-card-library', () => ({
  LearningCardLibrary: ({ refreshRevision }: { refreshRevision: number }) => (
    <div data-testid='library' data-revision={refreshRevision}>library</div>
  ),
}));
vi.mock('@/ui/features/focused-review/focused-review', () => ({
  FocusedReview: ({
    onOpenOriginalVideo,
  }: {
    onOpenOriginalVideo: (source: { startTime: number; url: string }) => Promise<void>;
  }) => {
    harness.openOriginalVideo = onOpenOriginalVideo;
    return <div data-testid='review'>review</div>;
  },
}));
vi.mock('@/ui/layout/connection-status', () => ({ ConnectionStatus: () => null }));
vi.mock('@/ui/layout/footer', () => ({ Footer: () => null }));
vi.mock('@/ui/layout/header', () => ({ Header: () => null }));
vi.mock('@/ui/pages/learning-settings-page', () => ({ LearningSettingsPage: () => <div>learning</div> }));
vi.mock('@/ui/pages/subtitle-upload-page', () => ({
  SubtitleUploadPage: (props: { cardRevision: number; learningCardStorage: unknown }) => {
    harness.subtitlePageProps = props;
    return <div data-testid='subtitles' data-revision={props.cardRevision}>subtitles</div>;
  },
}));
vi.mock('@/ui/store/page-store', () => ({
  usePageStore: (selector: (state: { currentPage: typeof harness.currentPage; setPage: typeof harness.setPage }) => unknown) =>
    selector({ currentPage: harness.currentPage, setPage: harness.setPage }),
}));
vi.mock('@/ui/store/tab-store', () => {
  const state = { initialize: harness.tabInitialize };
  const useTabStore = Object.assign(vi.fn(), { getState: () => state });
  return { useTabStore };
});

import { App } from './app';

describe('v2 side-panel boot boundary', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    harness.currentPage = 'library';
    harness.firstEntryComplete = undefined;
    harness.localListener = undefined;
    harness.openOriginalVideo = undefined;
    harness.subtitlePageProps = undefined;
    harness.settingsInitialize.mockResolvedValue({ remove: harness.settingsRemove });
    harness.tabInitialize.mockResolvedValue(harness.tabRemove);
    vi.mocked(chrome.storage.local.onChanged.addListener).mockImplementation((listener) => {
      harness.localListener = listener;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('does not initialize normal consumers before readiness resolves', async () => {
    localStorage.setItem('v2OnboardingComplete', 'true');
    const readiness = deferred<{ success: true; data: { status: 'ready' } }>();
    harness.sendMessage.mockReturnValueOnce(readiness.promise);

    act(() => root.render(<App />));
    expect(harness.settingsInitialize).not.toHaveBeenCalled();
    expect(harness.tabInitialize).not.toHaveBeenCalled();
    expect(chrome.storage.local.onChanged.addListener).not.toHaveBeenCalled();

    await act(async () => readiness.resolve({ success: true, data: { status: 'ready' } }));
    expect(harness.settingsInitialize).toHaveBeenCalledOnce();
    expect(harness.tabInitialize).toHaveBeenCalledOnce();
    expect(harness.settingsInitialize.mock.invocationCallOrder[0]).toBeLessThan(
      harness.tabInitialize.mock.invocationCallOrder[0]
    );
    expect(container.querySelector("[data-testid='library']")).not.toBeNull();
  });

  it('keeps normal consumers behind first entry and initializes only after completion', async () => {
    harness.sendMessage.mockResolvedValueOnce({ success: true, data: { status: 'ready' } });

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    expect(container.querySelector("[data-testid='first-entry']")).not.toBeNull();
    expect(harness.settingsInitialize).not.toHaveBeenCalled();

    await act(async () => harness.firstEntryComplete?.());
    expect(harness.settingsInitialize).toHaveBeenCalledOnce();
    expect(harness.tabInitialize).toHaveBeenCalledOnce();
  });

  it('retries a recoverable readiness error without starting consumers early', async () => {
    localStorage.setItem('v2OnboardingComplete', 'true');
    harness.sendMessage
      .mockResolvedValueOnce({
        success: true,
        data: { status: 'error', code: 'migration-failed' },
      })
      .mockResolvedValueOnce({ success: true, data: { status: 'ready' } });

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('v2_readiness_unavailable_title');
    expect(harness.settingsInitialize).not.toHaveBeenCalled();

    await act(async () => getButton(container, 'v2_retry').click());
    expect(harness.sendMessage).toHaveBeenNthCalledWith(2, 'retryV2Readiness');
    expect(harness.settingsInitialize).toHaveBeenCalledOnce();
  });

  it('refreshes cards without remounting and fails closed with consumer cleanup', async () => {
    localStorage.setItem('v2OnboardingComplete', 'true');
    harness.sendMessage.mockResolvedValue({ success: true, data: { status: 'ready' } });
    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    const library = container.querySelector<HTMLElement>("[data-testid='library']");
    if (!library || !harness.localListener) throw new Error('Expected ready Library listener');

    act(() => harness.localListener?.({ unrelated: { newValue: true } }));
    expect(container.querySelector("[data-testid='library']")).toBe(library);
    expect(library.dataset.revision).toBe('0');

    act(() => harness.localListener?.({ learningCards: { newValue: [] } }));
    expect(container.querySelector("[data-testid='library']")).toBe(library);
    expect(library.dataset.revision).toBe('1');

    act(() => harness.localListener?.({ learningCards: { newValue: undefined } }));
    expect(container.textContent).toContain('v2_readiness_unavailable_title');
    expect(harness.settingsRemove).toHaveBeenCalledOnce();
    expect(harness.tabRemove).toHaveBeenCalledOnce();
    expect(chrome.storage.local.onChanged.removeListener).toHaveBeenCalledOnce();
  });

  it('forwards canonical card storage revisions to the subtitle overview page', async () => {
    localStorage.setItem('v2OnboardingComplete', 'true');
    harness.currentPage = 'subtitles';
    harness.sendMessage.mockResolvedValue({ success: true, data: { status: 'ready' } });

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });

    expect(harness.subtitlePageProps).toMatchObject({
      cardRevision: 0,
      learningCardStorage: harness.learningCardStorage,
    });

    act(() => harness.localListener?.({ learningCards: { newValue: [] } }));
    expect(harness.subtitlePageProps).toMatchObject({
      cardRevision: 1,
      learningCardStorage: harness.learningCardStorage,
    });
  });

  it('removes a partial settings subscription when tab initialization fails', async () => {
    localStorage.setItem('v2OnboardingComplete', 'true');
    harness.sendMessage.mockResolvedValue({ success: true, data: { status: 'ready' } });
    harness.tabInitialize.mockRejectedValueOnce(new Error('tab state unavailable'));

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    expect(container.textContent).toContain('v2_readiness_unavailable_title');
    expect(harness.settingsRemove).toHaveBeenCalledOnce();
  });

  it('forwards exact video targets and rejects response and transport failures', async () => {
    localStorage.setItem('v2OnboardingComplete', 'true');
    harness.currentPage = 'review';
    harness.sendMessage
      .mockResolvedValueOnce({ success: true, data: { status: 'ready' } })
      .mockResolvedValueOnce({ success: true, data: undefined });

    await act(async () => {
      root.render(<App />);
      await Promise.resolve();
    });
    const openOriginalVideo = harness.openOriginalVideo;
    if (!openOriginalVideo) throw new Error('Expected Review video callback');
    const source = { url: 'https://www.coupangplay.com/play/example', startTime: 42 };

    await expect(openOriginalVideo(source)).resolves.toBeUndefined();
    expect(harness.sendMessage).toHaveBeenNthCalledWith(2, 'viewVideo', source);

    harness.sendMessage.mockResolvedValueOnce({ success: false, error: 'Tab unavailable' });
    await expect(openOriginalVideo(source)).rejects.toThrow('v2_review_open_video_error');

    const transportError = new Error('Runtime port closed');
    harness.sendMessage.mockRejectedValueOnce(transportError);
    await expect(openOriginalVideo(source)).rejects.toBe(transportError);
  });
});

const getButton = (scope: ParentNode, name: string) => {
  const button = Array.from(scope.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === name || candidate.getAttribute('aria-label') === name
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};
