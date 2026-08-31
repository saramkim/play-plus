import { act, StrictMode } from 'react';

import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ListeningSegmentKey,
  ListeningSourceKey,
} from '@/listening/domain/source-identity';
import type {
  CommitProgressResult,
  DifficultSaveResult,
  EndSessionResult,
  ListeningMissionController,
  ListeningMissionProgressResult,
  PlaySegmentResult,
} from '@/listening/session/mission-controller';
import type { ListeningMissionSnapshot } from '@/listening/session/mission-reducer';

import { ListeningMission } from './listening-mission';

const PRACTICED_AT = '2026-08-09T12:00:00+12:00';
const SOURCE_KEY = 'native:en' as ListeningSourceKey;
const TYPED_SENTINEL = 'typed-private-sentinel';

describe('ListeningMission asynchronous controller contract', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;

  beforeAll(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queueMicrotask(() => callback(0));
      return 1;
    });
  });

  beforeEach(() => {
    vi.mocked(chrome.i18n.getMessage).mockImplementation((messageName, substitutions) => {
      const values = Array.isArray(substitutions)
        ? substitutions
        : substitutions === undefined
          ? []
          : [substitutions];
      return values.length === 0 ? messageName : `${messageName}:${values.join('/')}`;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    container.remove();
  });

  afterAll(() => vi.unstubAllGlobals());

  describe('playback generations', () => {
    it('does not mutate progress or terminate when advertisement suspension interrupts playback', async () => {
      const harness = createHarness();
      harness.playSegment.mockResolvedValueOnce({ status: 'suspended' });

      await renderMission(root, harness, snapshot(1));

      expect(harness.playSegment.mock.calls).toEqual([[key(0), 1]]);
      expect(container.textContent).not.toContain('v2_listening_mission_terminal_title');
      expect(container.textContent).toContain('v2_listening_mission_round_progress:1/1');
      expect(harness.commitProgress).not.toHaveBeenCalled();
      expect(harness.endSession).not.toHaveBeenCalled();
    });

    it('auto-plays each current line once and ignores stale playback focus', async () => {
      const first = deferred<PlaySegmentResult>();
      const second = deferred<PlaySegmentResult>();
      const harness = createHarness();
      harness.playSegment
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => second.promise);

      await renderMission(root, harness, snapshot(2));
      expect(harness.playSegment.mock.calls).toEqual([[key(0), 1]]);

      await click(getButton(container, 'v2_listening_mission_hint'));
      expect(harness.playSegment).toHaveBeenCalledTimes(1);

      await click(getButton(container, 'v2_listening_mission_later'));
      expect(harness.playSegment.mock.calls).toEqual([
        [key(0), 1],
        [key(1), 1],
      ]);

      const exit = getButton(container, 'v2_listening_mission_exit');
      exit.focus();
      await settle(first, { status: 'played' });
      expect(document.activeElement).toBe(exit);
      expect(container.textContent).toContain('v2_listening_mission_round_progress:2/2');

      await settle(second, { status: 'played' });
      expect(document.activeElement).toBe(getTextarea(container));
      expect(harness.playSegment).toHaveBeenCalledTimes(2);
    });

    it('deduplicates each manual rate and lets the newest rate supersede stale focus', async () => {
      const again = deferred<PlaySegmentResult>();
      const slow = deferred<PlaySegmentResult>();
      const harness = createHarness();

      await renderMission(root, harness, snapshot(1));
      expect(harness.playSegment.mock.calls).toEqual([[key(0), 1]]);
      harness.playSegment
        .mockImplementationOnce(() => again.promise)
        .mockImplementationOnce(() => slow.promise);

      const listenAgain = getButton(container, 'v2_listening_mission_listen_again');
      const listenSlow = getButton(container, 'v2_listening_mission_listen_slow');
      await click(listenAgain);
      expect(listenAgain.disabled).toBe(true);
      act(() => listenAgain.click());
      expect(harness.playSegment).toHaveBeenCalledTimes(2);

      await click(listenSlow);
      expect(listenSlow.disabled).toBe(true);
      expect(harness.playSegment.mock.calls.slice(1)).toEqual([
        [key(0), 1],
        [key(0), 0.75],
      ]);

      const exit = getButton(container, 'v2_listening_mission_exit');
      exit.focus();
      await settle(again, { status: 'played' });
      expect(document.activeElement).toBe(exit);
      expect(listenAgain.disabled).toBe(false);
      expect(listenSlow.disabled).toBe(true);

      await settle(slow, { status: 'played' });
      expect(document.activeElement).toBe(getTextarea(container));
      expect(listenSlow.disabled).toBe(false);
    });

    it('keeps a newer same-rate replay pending when an old line resolves ABA-style', async () => {
      const oldLine = deferred<PlaySegmentResult>();
      const currentLine = deferred<PlaySegmentResult>();
      const harness = createHarness();
      harness.playSegment
        .mockImplementationOnce(() => oldLine.promise)
        .mockImplementationOnce(() => currentLine.promise);

      await renderMission(root, harness, snapshot(2));
      await click(getButton(container, 'v2_listening_mission_later'));

      const listenAgain = getButton(container, 'v2_listening_mission_listen_again');
      expect(listenAgain.disabled).toBe(true);
      await settle(oldLine, { status: 'played' });
      expect(listenAgain.disabled).toBe(true);
      act(() => listenAgain.click());
      expect(harness.playSegment).toHaveBeenCalledTimes(2);

      await settle(currentLine, { status: 'played' });
      expect(listenAgain.disabled).toBe(false);
      expect(document.activeElement).toBe(getTextarea(container));
    });

    it('clears a pending line announcement when Summary replaces active line truth', async () => {
      const pending = deferred<PlaySegmentResult>();
      const harness = createHarness();
      harness.playSegment.mockImplementationOnce(() => pending.promise);

      await renderMission(root, harness, snapshot(1));
      const playbackStatus = container.querySelector(
        "[data-testid='listening-playback-status']"
      );
      expect(playbackStatus?.textContent).toBe('v2_listening_mission_playing');

      await click(getButton(container, 'v2_listening_mission_later'));
      expect(container.textContent).toContain('v2_listening_mission_summary_title');
      expect(playbackStatus?.textContent).toBe('');

      await click(getButton(container, 'v2_listening_mission_view_results'));
      expect(container.textContent).toContain('v2_listening_mission_results_title');
      expect(playbackStatus?.textContent).toBe('');

      await settle(pending, { status: 'played' });
      expect(container.textContent).toContain('v2_listening_mission_results_title');
      expect(playbackStatus?.textContent).toBe('');
      expect(document.activeElement?.textContent).toBe('v2_listening_mission_results_title');
    });

    it('rehearses ownership without replacing the single live autoplay under StrictMode', async () => {
      const live = deferred<PlaySegmentResult>();
      const harness = createHarness();
      harness.playSegment.mockImplementationOnce(() => live.promise);

      await renderMission(root, harness, snapshot(1), { strict: true });
      expect(harness.onOwnershipChange.mock.calls).toEqual([[true], [false], [true]]);
      expect(harness.playSegment.mock.calls).toEqual([[key(0), 1]]);

      await settle(live, { status: 'played' });
      expect(document.activeElement).toBe(getTextarea(container));

      act(() => root?.unmount());
      root = undefined;
      expect(harness.onOwnershipChange.mock.calls).toEqual([
        [true],
        [false],
        [true],
        [false],
      ]);
    });
  });

  describe('progress and end sequencing', () => {
    it('commits Results once and gates every exit lane until saving succeeds', async () => {
      const pending = deferred<CommitProgressResult>();
      const harness = createHarness();
      harness.commitProgress.mockImplementationOnce(() => pending.promise);

      await renderMission(root, harness, snapshot(1));
      await finishExactResults(container, 1);

      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.getPracticedAt).toHaveBeenCalledTimes(1);
      expect(container.textContent).toContain('v2_listening_mission_progress_saving');
      const guarded = [
        getButton(container, 'v2_listening_mission_exit'),
        getButton(container, 'v2_listening_mission_next_10'),
        getButton(container, 'v2_listening_mission_continue_watching'),
        getButton(container, 'v2_listening_mission_close'),
      ];
      expect(guarded.every(({ disabled }) => disabled)).toBe(true);
      act(() => guarded.forEach((button) => button.click()));
      expect(harness.endSession).not.toHaveBeenCalled();
      expect(harness.onExit).not.toHaveBeenCalled();
      expect(harness.onNextMission).not.toHaveBeenCalled();

      await settle(pending, { status: 'saved' });
      expect(container.textContent).toContain('v2_listening_mission_progress_saved');
      expect(guarded.every(({ disabled }) => disabled)).toBe(false);
      await flush();
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
    });

    it('retries Results with the same frozen payload and timestamp', async () => {
      const first = deferred<CommitProgressResult>();
      const retry = deferred<CommitProgressResult>();
      const harness = createHarness();
      harness.commitProgress
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => retry.promise);

      await renderMission(root, harness, snapshot(2));
      await finishExactResults(container, 2);
      const originalPayload = getProgressPayload(harness);
      expect(Object.isFrozen(originalPayload)).toBe(true);
      expect(Object.isFrozen(originalPayload.items)).toBe(true);
      expect(originalPayload.items.every((item) => Object.isFrozen(item))).toBe(true);
      expect(originalPayload.practicedAt).toBe(PRACTICED_AT);

      await settle(first, { status: 'error' });
      expect(container.textContent).toContain('v2_listening_mission_progress_failed_title');
      await click(getButton(container, 'v2_listening_mission_retry_saving'));
      expect(harness.commitProgress).toHaveBeenCalledTimes(2);
      expect(getProgressPayload(harness, 1)).toBe(originalPayload);
      expect(harness.getPracticedAt).toHaveBeenCalledTimes(1);

      await settle(retry, { status: 'saved' });
      expect(container.textContent).toContain('v2_listening_mission_results_title');
      expect(container.textContent).toContain('v2_listening_mission_progress_saved');
      expect(harness.endSession).not.toHaveBeenCalled();
    });

    it('disables and guards discard during retry, then discards only after a settled failure', async () => {
      const first = deferred<CommitProgressResult>();
      const retry = deferred<CommitProgressResult>();
      const harness = createHarness();
      harness.commitProgress
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => retry.promise);

      await renderMission(root, harness, snapshot(1));
      await finishExactResults(container, 1);
      await settle(first, { status: 'error' });

      const retryButton = getButton(container, 'v2_listening_mission_retry_saving');
      const discard = getButton(container, 'v2_listening_mission_exit_without_saving');
      act(() => {
        retryButton.click();
        discard.click();
      });
      await flush();
      expect(discard.disabled).toBe(true);
      expect(harness.endSession).not.toHaveBeenCalled();
      expect(harness.onExit).not.toHaveBeenCalled();

      await settle(retry, { status: 'error' });
      expect(discard.disabled).toBe(false);
      await click(discard);
      expect(harness.endSession.mock.calls).toEqual([['complete-stay']]);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
      expect(harness.commitProgress).toHaveBeenCalledTimes(2);
    });

    it('retries a failed mid-exit save before restoring the captured start', async () => {
      const first = deferred<CommitProgressResult>();
      const retry = deferred<CommitProgressResult>();
      const harness = createHarness();
      harness.commitProgress
        .mockImplementationOnce(() => first.promise)
        .mockImplementationOnce(() => retry.promise);

      await renderMission(root, harness, snapshot(2));
      await click(getButton(container, 'v2_listening_mission_later'));
      await click(getButton(container, 'v2_listening_mission_exit'));
      await click(getButton(container, 'v2_listening_mission_save_and_exit'));
      const originalPayload = getProgressPayload(harness);
      expect(originalPayload.items).toEqual([
        {
          achievedState: 'attempted',
          segmentKey: key(0),
          submittedAttemptIncrement: 0,
        },
      ]);

      await settle(first, { status: 'error' });
      expect(container.textContent).toContain('v2_listening_mission_progress_failed_title');
      await click(getButton(container, 'v2_listening_mission_retry_saving'));
      expect(getProgressPayload(harness, 1)).toBe(originalPayload);
      await settle(retry, { status: 'saved' });

      expect(harness.endSession.mock.calls).toEqual([['restore-start']]);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
      expect(harness.getPracticedAt).toHaveBeenCalledTimes(1);
    });

    it('retries only the original end after progress is saved', async () => {
      const harness = createHarness();
      harness.endSession
        .mockResolvedValueOnce({ status: 'error' })
        .mockResolvedValueOnce({ status: 'ended' });

      await renderMission(root, harness, snapshot(1));
      await finishExactResults(container, 1);
      await click(getButton(container, 'v2_listening_mission_close'));

      expect(container.textContent).toContain('v2_listening_mission_end_error');
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.endSession.mock.calls).toEqual([['complete-stay']]);
      expect(harness.onExit).not.toHaveBeenCalled();

      await click(getButton(container, 'v2_listening_mission_retry_ending'));
      expect(harness.endSession.mock.calls).toEqual([
        ['complete-stay'],
        ['complete-stay'],
      ]);
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
    });

    it('keeps a failed exit-dialog end retry locked when Escape is pressed', async () => {
      const harness = createHarness();
      harness.endSession.mockResolvedValueOnce({ status: 'error' });

      await renderMission(root, harness, snapshot(2));
      await click(getButton(container, 'v2_listening_mission_later'));
      await click(getButton(container, 'v2_listening_mission_exit'));
      await click(getButton(container, 'v2_listening_mission_save_and_exit'));

      const dialog = container.querySelector<HTMLElement>("[role='alertdialog']");
      if (!dialog) throw new Error('Expected the failed exit dialog');
      const retry = getButton(dialog, 'v2_listening_mission_retry_ending');
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.endSession.mock.calls).toEqual([['restore-start']]);

      await dispatchKey(dialog, 'Escape');

      expect(container.querySelector("[role='alertdialog']")).toBe(dialog);
      expect(getButton(dialog, 'v2_listening_mission_retry_ending')).toBe(retry);
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.endSession.mock.calls).toEqual([['restore-start']]);
      expect(harness.onExit).not.toHaveBeenCalled();
    });

    it.each([
      ['ended', 'v2_listening_mission_close', 'complete-stay', 'exit'],
      ['already-ended', 'v2_listening_mission_continue_watching', 'continue-watching', 'exit'],
      ['stale', 'v2_listening_mission_next_10', 'complete-stay', 'next'],
      ['no-video', 'v2_listening_mission_close', 'complete-stay', 'exit'],
    ] as const)(
      'treats end status %s as terminal success for its original destination',
      async (status, actionName, mode, destination) => {
        const harness = createHarness();
        harness.endSession.mockResolvedValueOnce({ status });

        await renderMission(root, harness, snapshot(1));
        await finishExactResults(container, 1);
        await click(getButton(container, actionName));

        expect(harness.endSession.mock.calls).toEqual([[mode]]);
        expect(harness.commitProgress).toHaveBeenCalledTimes(1);
        if (destination === 'next') {
          expect(harness.onNextMission).toHaveBeenCalledTimes(1);
          expect(harness.onExit).not.toHaveBeenCalled();
        } else {
          expect(harness.onExit).toHaveBeenCalledTimes(1);
          expect(harness.onNextMission).not.toHaveBeenCalled();
        }
      }
    );
  });

  describe('terminal progress handling', () => {
    it('safe-exits a first-line terminal invalidation without constructing zero progress', async () => {
      const harness = createHarness();
      harness.getPracticedAt.mockImplementation(() => {
        throw new Error('invalid timestamp must remain unreachable');
      });
      harness.playSegment.mockResolvedValueOnce({ status: 'stale' });

      await renderMission(root, harness, snapshot(1, { support: true }));

      expect(container.textContent).toContain('v2_listening_mission_terminal_title');
      expect(container.textContent).toContain('v2_listening_mission_safe_exit');
      expect(container.textContent).not.toContain('v2_listening_mission_progress_unsaved');
      expect(container.textContent).not.toContain('Answer 1');
      expect(container.textContent).not.toContain('Support 1');
      expect(harness.getPracticedAt).not.toHaveBeenCalled();
      expect(harness.commitProgress).not.toHaveBeenCalled();

      await click(getButton(container, 'v2_listening_mission_safe_exit'));

      expect(harness.getPracticedAt).not.toHaveBeenCalled();
      expect(harness.commitProgress).not.toHaveBeenCalled();
      expect(harness.endSession.mock.calls).toEqual([['restore-start']]);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
    });

    it.each(['stale', 'no-video', 'segment-unavailable'] as const)(
      'saves only completed visits before a %s playback invalidation',
      async (status) => {
        const harness = createHarness();
        harness.playSegment
          .mockResolvedValueOnce({ status: 'played' })
          .mockResolvedValueOnce({ status });

        await renderMission(root, harness, snapshot(2, { support: true }));
        await click(getButton(container, 'v2_listening_mission_later'));

        expect(container.textContent).toContain('v2_listening_mission_terminal_title');
        expect(container.textContent).not.toContain('Answer 1');
        expect(container.textContent).not.toContain('Support 1');
        expect(container.querySelector('textarea')).toBeNull();
        await click(getButton(container, 'v2_listening_mission_safe_exit'));

        expect(getProgressPayload(harness).items).toEqual([
          {
            achievedState: 'attempted',
            segmentKey: key(0),
            submittedAttemptIncrement: 0,
          },
        ]);
        expect(harness.endSession.mock.calls).toEqual([['restore-start']]);
        expect(harness.onExit).toHaveBeenCalledTimes(1);
      }
    );

    it('offers truthful discard when a terminal partial-progress save fails', async () => {
      const harness = createHarness();
      harness.playSegment
        .mockResolvedValueOnce({ status: 'played' })
        .mockResolvedValueOnce({ status: 'stale' });
      harness.commitProgress.mockResolvedValueOnce({ status: 'error' });

      await renderMission(root, harness, snapshot(2));
      await click(getButton(container, 'v2_listening_mission_later'));
      await click(getButton(container, 'v2_listening_mission_safe_exit'));

      expect(container.textContent).toContain('v2_listening_mission_progress_unsaved');
      expect(container.textContent).toContain('v2_listening_mission_unsaved_lost');
      expect(harness.endSession).not.toHaveBeenCalled();
      await click(getButton(container, 'v2_listening_mission_exit_without_saving'));

      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.endSession.mock.calls).toEqual([['restore-start']]);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
    });

    it('sanitizes terminal text when practicedAt validation throws and retries payload creation', async () => {
      const harness = createHarness();
      harness.getPracticedAt
        .mockReturnValueOnce('invalid-practiced-at')
        .mockReturnValueOnce(PRACTICED_AT);
      harness.playSegment
        .mockResolvedValueOnce({ status: 'played' })
        .mockResolvedValueOnce({ status: 'stale' });

      await renderMission(root, harness, snapshot(2, { support: true }));
      changeTextarea(getTextarea(container), TYPED_SENTINEL);
      await click(getButton(container, 'v2_listening_mission_later'));

      expect(container.textContent).toContain('v2_listening_mission_terminal_title');
      expect(container.textContent).toContain('v2_listening_mission_progress_unsaved');
      expect(container.textContent).not.toContain(TYPED_SENTINEL);
      expect(container.textContent).not.toContain('Answer 1');
      expect(container.textContent).not.toContain('Support 1');
      assertNoSensitiveAttributes(container, [TYPED_SENTINEL, 'Answer 1', 'Support 1']);
      expect(harness.commitProgress).not.toHaveBeenCalled();

      await click(getButton(container, 'v2_listening_mission_retry_saving'));
      expect(harness.getPracticedAt).toHaveBeenCalledTimes(2);
      expect(getProgressPayload(harness).practicedAt).toBe(PRACTICED_AT);
      expect(harness.endSession.mock.calls).toEqual([['restore-start']]);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('difficult-line saves', () => {
    it('saves only selected lines and retains mixed busy/error failures for retry', async () => {
      const pending = deferred<DifficultSaveResult>();
      const harness = createHarness();
      harness.saveDifficultSegments.mockImplementationOnce(() => pending.promise);

      await renderMission(root, harness, snapshot(4, { support: true }));
      await finishLaterResults(container, 4);
      const save = getButton(container, 'v2_listening_mission_save_selected');
      expect(save.disabled).toBe(true);
      expect(getDifficultCheckbox(container, 4).checked).toBe(false);

      await click(getDifficultCheckbox(container, 1));
      await click(getDifficultCheckbox(container, 2));
      await click(getDifficultCheckbox(container, 3));
      await click(save);
      expect(harness.saveDifficultSegments.mock.calls).toEqual([[[key(0), key(1), key(2)]]]);
      expect(getDifficultCheckbox(container, 1).disabled).toBe(true);
      expect(getButton(container, 'v2_listening_mission_exit').disabled).toBe(true);
      expect(getButton(container, 'v2_listening_mission_close').disabled).toBe(true);
      act(() => getButton(container, 'v2_listening_mission_close').click());
      expect(harness.endSession).not.toHaveBeenCalled();

      await settle(pending, {
        retryableFailures: [
          { reason: 'busy', segmentKey: key(1) },
          { reason: 'error', segmentKey: key(2) },
        ],
        saved: [key(0)],
        terminalFailure: {
          reason: 'stale',
          segmentKey: 'segment-v1-controller-extra',
          unattempted: [key(3)],
        },
      });

      expect(container.textContent).toContain('v2_listening_mission_results_title');
      expect(getDifficultRow(container, 1).textContent).toContain(
        'v2_listening_mission_difficult_row_saved'
      );
      expect(getDifficultRow(container, 2).textContent).toContain(
        'v2_listening_mission_difficult_row_busy'
      );
      expect(getDifficultRow(container, 3).textContent).toContain(
        'v2_listening_mission_difficult_row_error'
      );
      expect(getDifficultCheckbox(container, 1).checked).toBe(false);
      expect(getDifficultCheckbox(container, 2).checked).toBe(true);
      expect(getDifficultCheckbox(container, 3).checked).toBe(true);
      expect(getDifficultCheckbox(container, 4).checked).toBe(false);

      await click(getButton(container, 'v2_listening_mission_save_selected'));
      expect(harness.saveDifficultSegments.mock.calls[1]).toEqual([[key(1), key(2)]]);
      expect(getDifficultRow(container, 2).textContent).toContain(
        'v2_listening_mission_difficult_row_saved'
      );
      expect(getDifficultRow(container, 3).textContent).toContain(
        'v2_listening_mission_difficult_row_saved'
      );
    });

    it('normalizes duplicate, extra, and conflicting terminal buckets to safe line ordinals', async () => {
      const extra = 'segment-v1-controller-extra';
      const harness = createHarness();
      harness.saveDifficultSegments.mockResolvedValueOnce({
        retryableFailures: [
          { reason: 'error', segmentKey: key(0) },
          { reason: 'busy', segmentKey: key(1) },
          { reason: 'error', segmentKey: key(1) },
          { reason: 'error', segmentKey: key(2) },
          { reason: 'busy', segmentKey: key(3) },
          { reason: 'error', segmentKey: extra },
        ],
        saved: [key(0), key(0), extra],
        terminalFailure: {
          reason: 'stale',
          segmentKey: key(3),
          unattempted: [
            key(4),
            key(5),
            key(5),
            extra,
            key(0),
            key(1),
            key(2),
            key(3),
          ],
        },
      });

      await renderMission(root, harness, snapshot(6, { support: true }));
      await finishLaterResults(container, 6);
      for (let line = 1; line <= 6; line += 1) {
        await click(getDifficultCheckbox(container, line));
      }
      await click(getButton(container, 'v2_listening_mission_save_selected'));

      expect(container.textContent).toContain('v2_listening_mission_terminal_title');
      expect(container.textContent).toContain(
        'v2_listening_mission_difficult_terminal_failed:4'
      );
      expect(container.textContent).toContain(
        'v2_listening_mission_difficult_terminal_saved_line:1'
      );
      expect(container.textContent).toContain(
        'v2_listening_mission_difficult_terminal_busy_line:2'
      );
      expect(container.textContent).toContain(
        'v2_listening_mission_difficult_terminal_error_line:3'
      );
      expect(container.textContent).toContain(
        'v2_listening_mission_difficult_terminal_unattempted_line:5'
      );
      expect(container.textContent).toContain(
        'v2_listening_mission_difficult_terminal_unattempted_line:6'
      );
      expect(container.textContent).not.toContain(extra);
      expect(container.textContent).not.toContain('segment-v1-');
      expect(container.textContent).not.toContain('Answer ');
      expect(container.textContent).not.toContain('Support ');

      await click(getButton(container, 'v2_listening_mission_safe_exit'));
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.endSession.mock.calls).toEqual([['complete-stay']]);
      expect(harness.onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe('lifecycle and privacy', () => {
    it('ignores late playback and progress promises after unmount and releases ownership once', async () => {
      const playback = deferred<PlaySegmentResult>();
      const progress = deferred<CommitProgressResult>();
      const harness = createHarness();
      harness.playSegment.mockImplementationOnce(() => playback.promise);
      harness.commitProgress.mockImplementationOnce(() => progress.promise);

      await renderMission(root, harness, snapshot(1));
      await click(getButton(container, 'v2_listening_mission_later'));
      await click(getButton(container, 'v2_listening_mission_view_results'));
      expect(harness.commitProgress).toHaveBeenCalledTimes(1);
      expect(harness.onOwnershipChange.mock.calls).toEqual([[true]]);

      act(() => root?.unmount());
      root = undefined;
      expect(harness.onOwnershipChange.mock.calls).toEqual([[true], [false]]);
      await settle(playback, { status: 'played' });
      await settle(progress, { status: 'saved' });

      expect(harness.onOwnershipChange.mock.calls).toEqual([[true], [false]]);
      expect(harness.endSession).not.toHaveBeenCalled();
      expect(harness.onExit).not.toHaveBeenCalled();
      expect(harness.onNextMission).not.toHaveBeenCalled();
    });

    it('does not complete an end callback when its promise settles after unmount', async () => {
      const ending = deferred<EndSessionResult>();
      const harness = createHarness();
      harness.endSession.mockImplementationOnce(() => ending.promise);

      await renderMission(root, harness, snapshot(1));
      await finishExactResults(container, 1);
      await click(getButton(container, 'v2_listening_mission_close'));
      expect(harness.endSession.mock.calls).toEqual([['complete-stay']]);

      act(() => root?.unmount());
      root = undefined;
      await settle(ending, { status: 'ended' });

      expect(harness.onExit).not.toHaveBeenCalled();
      expect(harness.onNextMission).not.toHaveBeenCalled();
      expect(harness.onOwnershipChange.mock.calls).toEqual([[true], [false]]);
    });

    it('never places a typed sentinel in controller/callback payloads or DOM attributes', async () => {
      const harness = createHarness();
      await renderMission(root, harness, snapshot(2, { support: true }));

      changeTextarea(getTextarea(container), TYPED_SENTINEL);
      assertNoSensitiveAttributes(container, [TYPED_SENTINEL]);
      await click(getButton(container, 'v2_listening_mission_listen_slow'));
      await click(getButton(container, 'v2_listening_mission_hint'));
      await click(getButton(container, 'v2_listening_mission_later'));
      await click(getButton(container, 'v2_listening_mission_later'));
      await click(getButton(container, 'v2_listening_mission_view_results'));
      await click(getDifficultCheckbox(container, 1));
      await click(getButton(container, 'v2_listening_mission_save_selected'));
      await click(getButton(container, 'v2_listening_mission_close'));

      const externalCalls = JSON.stringify({
        callbacks: {
          exit: harness.onExit.mock.calls,
          next: harness.onNextMission.mock.calls,
          ownership: harness.onOwnershipChange.mock.calls,
        },
        controller: {
          commit: harness.commitProgress.mock.calls,
          difficult: harness.saveDifficultSegments.mock.calls,
          end: harness.endSession.mock.calls,
          play: harness.playSegment.mock.calls,
        },
      });
      expect(externalCalls).not.toContain(TYPED_SENTINEL);
      expect(externalCalls).not.toContain('Answer 1');
      expect(externalCalls).not.toContain('Support 1');
      assertNoSensitiveAttributes(container, [TYPED_SENTINEL, 'Answer 1', 'Support 1']);
    });
  });
});

type MissionHarness = ReturnType<typeof createHarness>;

function getProgressPayload(harness: MissionHarness, index = 0) {
  const call = harness.commitProgress.mock.calls[index];
  if (!call) throw new Error(`Expected progress call ${index + 1}`);
  return call[0];
}

function createHarness() {
  const playSegment = vi.fn(
    async (_segmentKey: string, _rate: 1 | 0.75): Promise<PlaySegmentResult> => ({
      status: 'played',
    })
  );
  const commitProgress = vi.fn(
    async (_result: ListeningMissionProgressResult): Promise<CommitProgressResult> => ({
      status: 'saved',
    })
  );
  const endSession = vi.fn(
    async (
      _mode: Parameters<ListeningMissionController['endSession']>[0]
    ): Promise<EndSessionResult> => ({ status: 'ended' })
  );
  const saveDifficultSegments = vi.fn(
    async (segmentKeys: string[]): Promise<DifficultSaveResult> => ({
      retryableFailures: [],
      saved: segmentKeys,
    })
  );
  const controller = {
    commitProgress,
    endSession,
    playSegment,
    saveDifficultSegments,
  } satisfies ListeningMissionController;

  return {
    commitProgress,
    controller,
    endSession,
    getPracticedAt: vi.fn(() => PRACTICED_AT),
    onExit: vi.fn(),
    onNextMission: vi.fn(),
    onOwnershipChange: vi.fn(),
    playSegment,
    saveDifficultSegments,
  };
}

async function renderMission(
  reactRoot: Root | undefined,
  harness: MissionHarness,
  missionSnapshot: ListeningMissionSnapshot,
  options: { strict?: boolean } = {}
) {
  if (!reactRoot) throw new Error('Expected a React root');
  const mission = (
    <ListeningMission
      controller={harness.controller}
      getPracticedAt={harness.getPracticedAt}
      onExit={harness.onExit}
      onNextMission={harness.onNextMission}
      onOwnershipChange={harness.onOwnershipChange}
      snapshot={missionSnapshot}
    />
  );
  await act(async () => {
    reactRoot.render(options.strict ? <StrictMode>{mission}</StrictMode> : mission);
    await Promise.resolve();
  });
  await flush();
}

const key = (index: number): ListeningSegmentKey =>
  `segment-v1-${index.toString(16).padStart(64, '0')}` as ListeningSegmentKey;

const snapshot = (
  count: number,
  options: { support?: boolean } = {}
): ListeningMissionSnapshot => ({
  learningLanguage: 'en',
  segmenterVersion: 1,
  segments: Array.from({ length: count }, (_, index) => ({
    ...(options.support
      ? {
          alignedSupport: {
            sourceIndices: [index + 100],
            text: `Support ${index + 1}`,
          },
        }
      : {}),
    answerText: `Answer ${index + 1}`,
    segmentKey: key(index),
    sourceIndices: [index],
    sourceKey: SOURCE_KEY,
  })),
  sourceKey: SOURCE_KEY,
  videoId: '123e4567-e89b-12d3-a456-426614174040',
});

async function finishExactResults(scope: ParentNode, count: number) {
  for (let index = 0; index < count; index += 1) {
    changeTextarea(getTextarea(scope), `Answer ${index + 1}`);
    await click(getButton(scope, 'v2_listening_mission_submit'));
    await click(getButton(scope, 'v2_listening_mission_next'));
  }
  await flush();
  expect(scope.textContent).toContain('v2_listening_mission_results_title');
}

async function finishLaterResults(scope: ParentNode, count: number) {
  for (let index = 0; index < count; index += 1) {
    await click(getButton(scope, 'v2_listening_mission_later'));
  }
  expect(scope.textContent).toContain('v2_listening_mission_summary_title');
  await click(getButton(scope, 'v2_listening_mission_view_results'));
  expect(scope.textContent).toContain('v2_listening_mission_results_title');
  expect(scope.textContent).toContain('v2_listening_mission_progress_saved');
}

function changeTextarea(textarea: HTMLTextAreaElement, value: string) {
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (!setter) throw new Error('Expected native textarea value setter');
    setter.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function getTextarea(scope: ParentNode) {
  const textarea = scope.querySelector<HTMLTextAreaElement>('textarea');
  if (!textarea) throw new Error('Expected an answer textarea');
  return textarea;
}

function getDifficultCheckbox(scope: ParentNode, line: number) {
  const checkbox = scope.querySelector<HTMLInputElement>(
    `input[aria-label='v2_listening_mission_difficult_checkbox:${line}']`
  );
  if (!checkbox) throw new Error(`Expected difficult checkbox ${line}`);
  return checkbox;
}

function getDifficultRow(scope: ParentNode, line: number) {
  const row = getDifficultCheckbox(scope, line).closest('label');
  if (!row) throw new Error(`Expected difficult row ${line}`);
  return row;
}

function assertNoSensitiveAttributes(scope: ParentNode, sentinels: readonly string[]) {
  const attributeValues = Array.from(scope.querySelectorAll<HTMLElement>('*')).flatMap(
    (element) => Array.from(element.attributes, ({ value }) => value)
  );
  for (const sentinel of sentinels) {
    expect(attributeValues.every((value) => !value.includes(sentinel))).toBe(true);
  }
}

function getButton(scope: ParentNode, name: string) {
  const button = Array.from(scope.querySelectorAll<HTMLButtonElement>('button')).find(
    ({ textContent }) => textContent?.trim() === name || textContent?.trim().startsWith(`${name}:`)
  );
  if (!button) throw new Error(`Expected button: ${name}`);
  return button;
}

async function click(target: HTMLElement) {
  await act(async () => {
    target.click();
    await Promise.resolve();
  });
  await flush();
}

async function dispatchKey(target: Element, keyValue: string) {
  await act(async () => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: keyValue,
      })
    );
    await Promise.resolve();
  });
  await flush();
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

async function settle<T>(pending: Deferred<T>, value: NoInfer<T>) {
  await act(async () => {
    pending.resolve(value);
    await pending.promise;
  });
  await flush();
}
