import { act } from 'react';

import { listeningSegmentKeySchema } from '@storage/v2/schema';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ListeningMissionController, PlaySegmentResult } from '@/listening/session/mission-controller';
import type { ListeningMissionSnapshot } from '@/listening/session/mission-snapshot';

import { ListeningMission } from './listening-mission';

const key = (index: number) => listeningSegmentKeySchema.parse(`segment-v1-${String(index).padStart(64, '0')}`);
const snapshot: ListeningMissionSnapshot = {
  learningLanguage: 'en', sourceKey: 'native:en', segmenterVersion: 1, videoId: 'video-a',
  segments: [0, 1].map((index) => ({
    segmentKey: key(index), sourceKey: 'native:en', sourceIndices: [index],
    startMs: index * 2000, endMs: index * 2000 + 1000, answerText: `Take the train ${index}`,
    alignedSupport: { sourceIndices: [index], text: `기차를 타세요 ${index}` },
  })),
};
const deferred = <T,>() => {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

describe('One-line listening practice', () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: ListeningMissionController;
  let onExit: ReturnType<typeof vi.fn<() => void>>;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('chrome', { i18n: { getMessage: (key: string) => key } });
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 1; });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    onExit = vi.fn();
    controller = {
      playSegment: vi.fn().mockResolvedValue({ status: 'played' }),
      endSession: vi.fn().mockResolvedValue({ status: 'ended' }),
      saveDifficultSegments: vi.fn().mockResolvedValue({ saved: [key(1)], retryableFailures: [] }),
    };
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });
  const render = async (initial: string | undefined = key(1), context = 'a') => {
    await act(async () => root.render(<ListeningMission snapshot={snapshot} controller={controller} initialSegmentKey={initial} boundContextKey={context} onExit={onExit} />));
  };
  const button = (name: string) => {
    const result = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.trim() === name);
    if (!result) throw new Error(`Missing ${name}`);
    return result;
  };
  const click = async (name: string) => { await act(async () => button(name).click()); };
  const type = (value: string) => {
    const textarea = container.querySelector('textarea')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return textarea;
  };

  it('replays one selected line and offers immediate reveal without a typing gate or progress write', async () => {
    const playback = deferred<PlaySegmentResult>();
    vi.mocked(controller.playSegment).mockReturnValue(playback.promise);
    await render();
    expect(controller.playSegment).toHaveBeenCalledExactlyOnceWith(key(1), 1);
    expect(container.textContent).not.toContain('Take the train');
    await click('v2_listening_reveal');
    expect(container.textContent).toContain('Take the train 1');
    expect(container.textContent).toContain('기차를 타세요 1');
    expect(container.querySelector('textarea')).toBeNull();
    await act(async () => playback.resolve({ status: 'played' }));
    expect(controller).not.toHaveProperty('commitProgress');
    expect(controller.playSegment).toHaveBeenCalledTimes(1);
  });

  it('can listen with visible subtitles and immediately switch to a fresh hidden replay', async () => {
    await render();
    await click('v2_listening_reveal');
    const visible = deferred<PlaySegmentResult>();
    vi.mocked(controller.playSegment).mockReturnValueOnce(visible.promise).mockResolvedValueOnce({ status: 'played' });
    await click('v2_listening_visible_replay');
    expect(container.textContent).toContain('Take the train 1');
    expect(button('v2_listening_hide_replay').disabled).toBe(false);
    await click('v2_listening_hide_replay');
    expect(container.textContent).not.toContain('Take the train 1');
    expect(container.textContent).toContain('v2_listening_blind_completed');
    await act(async () => visible.resolve({ status: 'played' }));
    expect(container.textContent).toContain('v2_listening_blind_completed');
  });

  it('removes answer, support, draft and scaffold before replay, retaining the draft for the same line', async () => {
    await render();
    await click('v2_listening_type_optional');
    type('Take train');
    await click('v2_listening_compare');
    expect(container.querySelector('[aria-label="v2_listening_matched_parts"]')).not.toBeNull();
    await click('v2_listening_reveal');
    vi.mocked(controller.playSegment).mockImplementation(async () => {
      expect(container.textContent).not.toContain('Take the train');
      expect(container.textContent).not.toContain('기차를');
      expect(container.querySelector('textarea')).toBeNull();
      expect(container.querySelector('[aria-label="v2_listening_matched_parts"]')).toBeNull();
      return { status: 'played' };
    });
    await click('v2_listening_hide_replay');
    expect(container.textContent).toContain('v2_listening_blind_completed');
    expect(document.activeElement).toBe(button('v2_listening_return'));
    await click('v2_listening_type_optional');
    expect(container.querySelector('textarea')?.value).toBe('Take train');
    expect(container.textContent).not.toContain('v2_listening_blind_completed');
  });

  it.each(['reveal', 'type_optional'])('does not count hidden playback if text is exposed via %s during playback', async (action) => {
    await render();
    const replay = deferred<PlaySegmentResult>();
    vi.mocked(controller.playSegment).mockReturnValue(replay.promise);
    await click('v2_listening_hide_replay');
    await click('v2_listening_' + action);
    await act(async () => replay.resolve({ status: 'played' }));
    expect(container.textContent).not.toContain('v2_listening_blind_completed');
  });

  it.each(['error', 'suspended', 'stale'] as const)('never counts %s playback as completed', async (status) => {
    await render();
    vi.mocked(controller.playSegment).mockResolvedValue({ status });
    await click('v2_listening_hide_slow');
    expect(controller.playSegment).toHaveBeenLastCalledWith(key(1), 0.75);
    expect(container.textContent).not.toContain('v2_listening_blind_completed');
  });

  it('keeps drafts unchanged, compares only on submit and clears feedback when hidden', async () => {
    await render();
    await click('v2_listening_type_optional');
    type('Take train');
    await click('v2_listening_compare');
    const original = container.querySelector('[aria-label="v2_listening_matched_parts"]')?.textContent;
    type('different');
    expect(container.querySelector('[aria-label="v2_listening_matched_parts"]')?.textContent).toBe(original);
    await click('v2_listening_compare');
    expect(container.textContent).toContain('v2_listening_comparison_different');
    expect(container.querySelector('textarea')?.value).toBe('different');
    type('TAKE THE TRAIN 1!');
    await click('v2_listening_compare');
    expect(container.textContent).toContain('v2_listening_comparison_exact');
    expect(controller).not.toHaveProperty('commitProgress');
  });

  it('does not submit IME Enter and preserves Shift+Enter for multiline drafts', async () => {
    await render();
    await click('v2_listening_type_optional');
    const textarea = type('기차');
    act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    expect(container.textContent).not.toContain('v2_listening_comparison_different');
    act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true })));
    expect(container.textContent).not.toContain('v2_listening_comparison_different');
    act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(container.textContent).toContain('v2_listening_comparison_different');
  });

  it('allows exit during playback without saving progress and ignores the late replay response', async () => {
    const replay = deferred<PlaySegmentResult>();
    vi.mocked(controller.playSegment).mockReturnValue(replay.promise);
    await render();
    await click('v2_listening_return');
    expect(controller.endSession).toHaveBeenCalledExactlyOnceWith('restore-start');
    expect(onExit).toHaveBeenCalledOnce();
    expect(controller).not.toHaveProperty('commitProgress');
    await act(async () => replay.resolve({ status: 'played' }));
    expect(container.textContent).not.toContain('v2_listening_blind_completed');
  });

  it('retries failed restoration directly with no discard/progress dialog', async () => {
    vi.mocked(controller.endSession).mockResolvedValueOnce({ status: 'error' }).mockResolvedValueOnce({ status: 'ended' });
    await render();
    await click('v2_listening_return');
    expect(onExit).not.toHaveBeenCalled();
    expect(container.textContent).toContain('v2_listening_mission_end_error');
    await click('v2_listening_return');
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('only saves the explicit current selection and keeps exit available during a save', async () => {
    await render();
    expect(controller.saveDifficultSegments).not.toHaveBeenCalled();
    const save = deferred<Awaited<ReturnType<ListeningMissionController['saveDifficultSegments']>>>();
    vi.mocked(controller.saveDifficultSegments).mockReturnValue(save.promise);
    await click('v2_listening_save_line');
    expect(controller.saveDifficultSegments).toHaveBeenCalledExactlyOnceWith([key(1)]);
    await click('v2_listening_return');
    expect(onExit).toHaveBeenCalledOnce();
    await act(async () => save.resolve({ saved: [key(1)], retryableFailures: [] }));
  });

  it('manually reselects only from the frozen snapshot and clears another line’s draft', async () => {
    await render();
    await click('v2_listening_type_optional');
    type('private draft');
    await click('v2_listening_landing_continue');
    expect(container.textContent).toContain('Take the train 0');
    expect(container.textContent).not.toContain('Take the train 2');
    const line = Array.from(container.querySelectorAll('li button')).find((node) => node.textContent?.includes('Take the train 0')) as HTMLButtonElement;
    await act(async () => line.click());
    expect(controller.playSegment).toHaveBeenLastCalledWith(key(0), 1);
    await click('v2_listening_type_optional');
    expect(container.querySelector('textarea')?.value).toBe('');
  });

  it('opens the explicit past picker without automatic playback', async () => {
    await act(async () => root.render(<ListeningMission snapshot={snapshot} controller={controller} onExit={onExit} />));
    expect(controller.playSegment).not.toHaveBeenCalled();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it.each([320, 360, 390])('has one scroll owner and reachable actions at %ipx', async (width) => {
    container.style.width = width + 'px';
    await render();
    expect(container.querySelectorAll('[data-scroll-owner]')).toHaveLength(1);
    for (const node of Array.from(container.querySelectorAll('button'))) expect(node.className).toContain('min-h-11');
  });
});
