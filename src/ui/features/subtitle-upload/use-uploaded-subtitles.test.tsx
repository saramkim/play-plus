import { act } from 'react';

import type { SubtitleId } from '@storage/subtitle';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { RegisteredSubtitleRefreshError } from './subtitle-mutation-error';
import { useUploadedSubtitles } from './use-uploaded-subtitles';

const SUBTITLE_ID = 'subtitle-00000000-0000-4000-8000-000000000001' as SubtitleId;

const dependencies = vi.hoisted(() => ({
  deleteRegisteredSubtitle: vi.fn(),
  getRegisteredSubtitles: vi.fn(async () => []),
  modalAlert: vi.fn(),
  onRegisteredSubtitlesChange: vi.fn(() => ({ remove: vi.fn() })),
  sendMessageToTab: vi.fn(),
  updateRegisteredSubtitle: vi.fn(),
}));

vi.mock('@storage/registered-subtitle', () => ({
  deleteRegisteredSubtitle: dependencies.deleteRegisteredSubtitle,
  getRegisteredSubtitles: dependencies.getRegisteredSubtitles,
  onRegisteredSubtitlesChange: dependencies.onRegisteredSubtitlesChange,
  updateRegisteredSubtitle: dependencies.updateRegisteredSubtitle,
}));
vi.mock('@storage/v2/schema', () => ({
  migrationStateSchema: { parse: () => ({ unavailableRegisteredSubtitles: [] }) },
}));
vi.mock('@utils/message', () => ({ sendMessageToTab: dependencies.sendMessageToTab }));
vi.mock('@/ui/components/modal', () => ({
  modal: { alert: dependencies.modalAlert, confirm: vi.fn() },
}));

describe('useUploadedSubtitles updateDelay', () => {
  let api: ReturnType<typeof useUploadedSubtitles> | undefined;
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(async () => {
    vi.clearAllMocks();
    dependencies.getRegisteredSubtitles.mockResolvedValue([]);
    dependencies.updateRegisteredSubtitle.mockResolvedValue(undefined);
    dependencies.sendMessageToTab.mockResolvedValue({ success: true });
    vi.mocked(chrome.storage.local.get).mockImplementation(((_keys, callback?: (items: object) => void) => {
      const items = { migrationState: {} };
      if (callback) return callback(items);
      return Promise.resolve(items);
    }) as typeof chrome.storage.local.get);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<Harness activeTab={{ id: 7 } as chrome.tabs.Tab} onRender={(value) => (api = value)} />);
      await Promise.resolve();
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('updates storage and refreshes the active video', async () => {
    await act(async () => getApi(api).updateDelay(SUBTITLE_ID, 1.2));

    expect(dependencies.updateRegisteredSubtitle).toHaveBeenCalledWith(SUBTITLE_ID, { delay: 1.2 });
    expect(dependencies.sendMessageToTab).toHaveBeenCalledWith(7, 'refreshRegisteredSubtitle', {
      subtitleId: SUBTITLE_ID,
    });
    expect(dependencies.modalAlert).not.toHaveBeenCalled();
  });

  it('preserves a storage failure and does not attempt a refresh', async () => {
    const storageError = new Error('storage failed');
    dependencies.updateRegisteredSubtitle.mockRejectedValueOnce(storageError);

    await expect(getApi(api).updateDelay(SUBTITLE_ID, 1.2)).rejects.toBe(storageError);

    expect(dependencies.sendMessageToTab).not.toHaveBeenCalled();
    expect(dependencies.modalAlert).not.toHaveBeenCalled();
  });

  it.each([
    ['a rejected message', () => dependencies.sendMessageToTab.mockRejectedValueOnce(new Error('disconnected'))],
    ['an unsuccessful response', () => dependencies.sendMessageToTab.mockResolvedValueOnce({ success: false })],
  ])('throws a typed inline failure without opening a modal for %s', async (_label, arrange) => {
    arrange();

    await expect(getApi(api).updateDelay(SUBTITLE_ID, 1.2)).rejects.toBeInstanceOf(
      RegisteredSubtitleRefreshError
    );

    expect(dependencies.updateRegisteredSubtitle).toHaveBeenCalledOnce();
    expect(dependencies.modalAlert).not.toHaveBeenCalled();
  });
});

function Harness({
  activeTab,
  onRender,
}: {
  activeTab: chrome.tabs.Tab;
  onRender: (api: ReturnType<typeof useUploadedSubtitles>) => void;
}) {
  onRender(useUploadedSubtitles(activeTab));
  return null;
}

function getApi(api: ReturnType<typeof useUploadedSubtitles> | undefined) {
  if (!api) throw new Error('Expected the hook API to be available');
  return api;
}
