import { act } from 'react';

import type { SubtitleId } from '@storage/subtitle';
import type { V2SubtitleCue } from '@storage/v2/type';
import { createRoot, Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRegisteredSubtitlePreview } from './use-registered-subtitle-preview';

const harness = vi.hoisted(() => ({
  getLocalSubtitle: vi.fn(),
}));

vi.mock('@storage/subtitle', () => ({
  getLocalSubtitle: harness.getLocalSubtitle,
}));

const FIRST_ID = 'subtitle-00000000-0000-4000-8000-000000000001' as SubtitleId;
const SECOND_ID = 'subtitle-00000000-0000-4000-8000-000000000002' as SubtitleId;

describe('useRegisteredSubtitlePreview', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true));

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  it('strictly reads the requested local subtitle body', async () => {
    harness.getLocalSubtitle.mockResolvedValueOnce([
      { start: 1, end: 2, text: 'Local cue' },
    ]);

    await renderHarness(root, FIRST_ID, true);

    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.cues).toBe('Local cue');
    expect(harness.getLocalSubtitle).toHaveBeenCalledOnce();
    expect(harness.getLocalSubtitle).toHaveBeenCalledWith(FIRST_ID);
  });

  it('isolates a late body by subtitle id and generation', async () => {
    const first = deferred<V2SubtitleCue[]>();
    const second = deferred<V2SubtitleCue[]>();
    harness.getLocalSubtitle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    await renderHarness(root, FIRST_ID, true);
    await renderHarness(root, SECOND_ID, true);

    await act(async () => {
      first.resolve([{ start: 1, end: 2, text: 'Stale cue' }]);
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.status).toBe('loading');
    expect(getOutput(container).dataset.cues).toBe('');

    await act(async () => {
      second.resolve([{ start: 3, end: 4, text: 'Current cue' }]);
      await flushMicrotasks();
    });
    expect(getOutput(container).dataset.subtitleId).toBe(SECOND_ID);
    expect(getOutput(container).dataset.cues).toBe('Current cue');
  });

  it('shows an unavailable state without reading or retaining an old body', async () => {
    harness.getLocalSubtitle.mockResolvedValueOnce([
      { start: 1, end: 2, text: 'Previously available cue' },
    ]);
    await renderHarness(root, FIRST_ID, true);
    expect(getOutput(container).dataset.status).toBe('ready');

    await renderHarness(root, FIRST_ID, false);

    expect(getOutput(container).dataset.status).toBe('unavailable');
    expect(getOutput(container).dataset.cues).toBe('');
    expect(harness.getLocalSubtitle).toHaveBeenCalledOnce();
  });

  it('exposes a retryable generic error without retaining rejected data', async () => {
    harness.getLocalSubtitle
      .mockRejectedValueOnce(new Error('private cue body must not surface'))
      .mockResolvedValueOnce([{ start: 5, end: 6, text: 'Recovered cue' }]);

    await renderHarness(root, FIRST_ID, true);
    expect(getOutput(container).dataset.status).toBe('error');
    expect(container.textContent).not.toContain('private cue body');

    await act(async () => {
      getRetryButton(container).click();
      await flushMicrotasks();
    });

    expect(harness.getLocalSubtitle).toHaveBeenCalledTimes(2);
    expect(getOutput(container).dataset.status).toBe('ready');
    expect(getOutput(container).dataset.cues).toBe('Recovered cue');
  });
});

function PreviewHarness({ available, subtitleId }: { available: boolean; subtitleId: SubtitleId }) {
  const { retry, viewState } = useRegisteredSubtitlePreview(subtitleId, available);
  const cues = viewState.status === 'ready' ? viewState.cues.map(({ text }) => text).join('|') : '';

  return (
    <div
      data-testid='output'
      data-cues={cues}
      data-status={viewState.status}
      data-subtitle-id={viewState.subtitleId}
    >
      <button type='button' onClick={retry}>
        retry
      </button>
    </div>
  );
}

const renderHarness = async (root: Root, subtitleId: SubtitleId, available: boolean) => {
  await act(async () => {
    root.render(<PreviewHarness available={available} subtitleId={subtitleId} />);
    await flushMicrotasks();
  });
};

const getOutput = (container: HTMLElement) => {
  const output = container.querySelector<HTMLElement>("[data-testid='output']");
  if (!output) throw new Error('Expected preview hook output');
  return output;
};

const getRetryButton = (container: HTMLElement) => {
  const button = container.querySelector('button');
  if (!button) throw new Error('Expected retry button');
  return button;
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

const flushMicrotasks = () => Promise.resolve();
