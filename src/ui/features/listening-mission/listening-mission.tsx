import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
} from 'react';

import { t } from '@utils/i18n';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  HeadphonesIcon,
  RotateCcwIcon,
  SparklesIcon,
  XIcon,
} from 'lucide-react';

import type {
  DifficultSaveResult,
  ListeningMissionController,
  ListeningMissionProgressResult,
  ListeningTerminalReason,
} from '@/listening/session/mission-controller';
import {
  createListeningMissionProgressResult,
  createListeningMissionState,
  listeningMissionReducer,
  selectListeningMissionView,
  type ListeningMissionSnapshot,
} from '@/listening/session/mission-reducer';
import { Button } from '@/ui/components/button';

const ACTION_CLASS =
  'min-h-11 h-auto min-w-0 whitespace-normal px-3 py-2 text-wrap motion-reduce:transition-none';

type ProgressStatus = 'idle' | 'saving' | 'saved' | 'error';
type ProgressFailureOrigin = 'mid-mission' | 'results';
type EndDestination = 'exit' | 'next-mission';

type DifficultFeedback = {
  busyCount: number;
  errorCount: number;
  savedCount: number;
};

type TerminalDifficultDetail = {
  busyLines: number[];
  errorLines: number[];
  failedLine?: number;
  savedLines: number[];
  unattemptedLines: number[];
};

export interface ListeningMissionProps {
  snapshot: ListeningMissionSnapshot;
  controller: ListeningMissionController;
  getPracticedAt: () => string;
  onExit: () => void;
  onNextMission: () => void;
  onOwnershipChange?: (owned: boolean) => void;
}

export function ListeningMission({
  snapshot,
  controller,
  getPracticedAt,
  onExit,
  onNextMission,
  onOwnershipChange,
}: ListeningMissionProps) {
  const [state, dispatch] = useReducer(
    listeningMissionReducer,
    snapshot,
    createListeningMissionState
  );
  const view = selectListeningMissionView(state);
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'playing' | 'played' | 'error'>(
    'idle'
  );
  const [pendingReplayRates, setPendingReplayRates] = useState<ReadonlySet<1 | 0.75>>(
    new Set()
  );
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('idle');
  const [progressFailureOrigin, setProgressFailureOrigin] =
    useState<ProgressFailureOrigin>();
  const [endError, setEndError] = useState(false);
  const [endPending, setEndPending] = useState(false);
  const [lastEndRequest, setLastEndRequest] = useState<{
    mode: Parameters<ListeningMissionController['endSession']>[0];
    destination: EndDestination;
  }>();
  const [difficultPending, setDifficultPending] = useState(false);
  const [difficultFeedback, setDifficultFeedback] = useState<DifficultFeedback>();
  const [terminalDetail, setTerminalDetail] = useState<TerminalDifficultDetail>();
  const [terminalEndMode, setTerminalEndMode] =
    useState<Parameters<ListeningMissionController['endSession']>[0]>('restore-start');
  const answerId = useId();
  const dialogDescriptionId = useId();
  const dialogTitleId = useId();
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const continueDialogRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const difficultSaveRef = useRef<HTMLButtonElement>(null);
  const endRetryRef = useRef<HTMLButtonElement>(null);
  const exitTriggerRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const phaseHeadingRef = useRef<HTMLHeadingElement>(null);
  const progressRetryRef = useRef<HTMLButtonElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const activePlaybackGenerationRef = useRef(0);
  const activeSegmentKeyRef = useRef(view.activeSegment?.segmentKey);
  const autoPlayedLineRef = useRef<string | undefined>(undefined);
  const difficultGenerationRef = useRef(0);
  const difficultPendingRef = useRef(false);
  const endGenerationRef = useRef(0);
  const endPendingRef = useRef(false);
  const exitOriginRef = useRef<ProgressFailureOrigin>('mid-mission');
  const compositionGuardGenerationRef = useRef(0);
  const isComposingRef = useRef(false);
  const suppressNextCompositionEnterRef = useRef(false);
  const mountedRef = useRef(true);
  const ownershipReleasedRef = useRef(false);
  const pendingReplayTokensRef = useRef(new Map<1 | 0.75, number>());
  const progressGenerationRef = useRef(0);
  const progressPayloadBuildFailedRef = useRef(false);
  const progressPayloadRef = useRef<ListeningMissionProgressResult | undefined>(undefined);
  const progressPendingRef = useRef(false);
  const progressSavedRef = useRef(false);
  const practicedAtRef = useRef<string | undefined>(undefined);
  const restoreExitFocusRef = useRef(false);
  const resultsCommitStartedRef = useRef(false);
  const previousAnswerVisibleRef = useRef(false);
  const previousPhaseRef = useRef(view.phase);
  const stateRef = useRef(state);

  activeSegmentKeyRef.current = view.activeSegment?.segmentKey;
  stateRef.current = state;

  const releaseOwnership = useCallback(() => {
    if (ownershipReleasedRef.current) return;
    ownershipReleasedRef.current = true;
    onOwnershipChange?.(false);
  }, [onOwnershipChange]);

  useEffect(() => {
    mountedRef.current = true;
    ownershipReleasedRef.current = false;
    onOwnershipChange?.(true);
    return () => {
      mountedRef.current = false;
      difficultGenerationRef.current += 1;
      endGenerationRef.current += 1;
      progressGenerationRef.current += 1;
      releaseOwnership();
    };
  }, [onOwnershipChange, releaseOwnership]);

  const ensureProgressPayload = useCallback(() => {
    if (progressPayloadRef.current) return progressPayloadRef.current;
    if (selectListeningMissionView(stateRef.current).completedVisitCount === 0) {
      progressPayloadBuildFailedRef.current = false;
      return undefined;
    }
    try {
      const practicedAt = practicedAtRef.current ?? getPracticedAt();
      const result = createListeningMissionProgressResult(stateRef.current, practicedAt);
      if (!result) {
        progressPayloadBuildFailedRef.current = false;
        return undefined;
      }
      result.items.forEach((item) => Object.freeze(item));
      Object.freeze(result.items);
      Object.freeze(result);
      practicedAtRef.current = practicedAt;
      progressPayloadBuildFailedRef.current = false;
      progressPayloadRef.current = result;
      return result;
    } catch {
      progressPayloadBuildFailedRef.current = true;
      return undefined;
    }
  }, [getPracticedAt]);

  const invalidate = useCallback(
    (
      reason: ListeningTerminalReason,
      mode: Parameters<ListeningMissionController['endSession']>[0],
      detail?: typeof terminalDetail
    ) => {
      ensureProgressPayload();
      if (progressPayloadBuildFailedRef.current) setProgressStatus('error');
      activePlaybackGenerationRef.current += 1;
      difficultGenerationRef.current += 1;
      pendingReplayTokensRef.current.clear();
      setPendingReplayRates(new Set());
      setTerminalDetail(detail);
      setTerminalEndMode(mode);
      setPlaybackStatus('idle');
      dispatch({ type: 'terminal-received', reason });
    },
    [ensureProgressPayload]
  );

  const playSegment = useCallback(
    async (rate: 1 | 0.75) => {
      const segmentKey = activeSegmentKeyRef.current;
      if (!segmentKey || pendingReplayTokensRef.current.has(rate)) return;

      const generation = ++activePlaybackGenerationRef.current;
      pendingReplayTokensRef.current.set(rate, generation);
      setPendingReplayRates(new Set(pendingReplayTokensRef.current.keys()));
      setPlaybackStatus('playing');
      let result: Awaited<ReturnType<ListeningMissionController['playSegment']>>;
      try {
        result = await controller.playSegment(segmentKey, rate);
      } catch {
        result = { status: 'error' };
      } finally {
        if (pendingReplayTokensRef.current.get(rate) === generation) {
          pendingReplayTokensRef.current.delete(rate);
        }
        if (mountedRef.current) {
          setPendingReplayRates(new Set(pendingReplayTokensRef.current.keys()));
        }
      }

      if (
        !mountedRef.current ||
        generation !== activePlaybackGenerationRef.current ||
        activeSegmentKeyRef.current !== segmentKey
      ) {
        return;
      }
      if (result.status === 'played') {
        setPlaybackStatus('played');
        answerRef.current?.focus();
        return;
      }
      if (result.status === 'error') {
        setPlaybackStatus('error');
        return;
      }
      invalidate(result.status, 'restore-start');
    },
    [controller, invalidate]
  );

  useEffect(() => {
    const segmentKey = view.activeSegment?.segmentKey;
    if (!segmentKey || !view.activeRound) {
      activePlaybackGenerationRef.current += 1;
      compositionGuardGenerationRef.current += 1;
      isComposingRef.current = false;
      pendingReplayTokensRef.current.clear();
      suppressNextCompositionEnterRef.current = false;
      setPendingReplayRates(new Set());
      setPlaybackStatus('idle');
      return;
    }
    if (autoPlayedLineRef.current === view.activeLineId) return;
    autoPlayedLineRef.current = view.activeLineId;
    activePlaybackGenerationRef.current += 1;
    compositionGuardGenerationRef.current += 1;
    isComposingRef.current = false;
    pendingReplayTokensRef.current.clear();
    suppressNextCompositionEnterRef.current = false;
    setPendingReplayRates(new Set());
    setPlaybackStatus('idle');
    void playSegment(1);
  }, [playSegment, view.activeLineId, view.activeRound, view.activeSegment?.segmentKey]);

  useEffect(() => {
    const phaseChanged = previousPhaseRef.current !== view.phase;
    previousPhaseRef.current = view.phase;
    if (!phaseChanged) return;

    if (view.phase === 'first-round-summary' || view.phase === 'results') {
      phaseHeadingRef.current?.focus();
    } else if (view.phase === 'progress-save-failure') {
      progressRetryRef.current?.focus();
    } else if (view.phase === 'terminal-invalidation') {
      terminalRef.current?.focus();
    }
  }, [view.phase]);

  useEffect(() => {
    if (view.phase !== 'exit-confirmation') return;
    continueDialogRef.current?.focus();
  }, [view.phase]);

  useEffect(() => {
    if (!restoreExitFocusRef.current || view.phase === 'exit-confirmation') return;
    restoreExitFocusRef.current = false;
    requestAnimationFrame(() => exitTriggerRef.current?.focus());
  }, [view.phase]);

  useEffect(() => {
    if (view.answerVisible && !previousAnswerVisibleRef.current) nextRef.current?.focus();
    previousAnswerVisibleRef.current = view.answerVisible;
  }, [view.answerVisible]);

  const commitProgress = useCallback(
    async (origin: ProgressFailureOrigin) => {
      if (progressSavedRef.current) return true;
      if (progressPendingRef.current) return false;
      dispatch({ type: 'progress-save-started', origin });
      const progressResult = ensureProgressPayload();
      if (!progressResult) {
        setProgressStatus('error');
        setProgressFailureOrigin(origin);
        dispatch({ type: 'progress-save-failed', origin });
        return false;
      }
      const generation = ++progressGenerationRef.current;
      progressPendingRef.current = true;
      setProgressStatus('saving');
      let result: Awaited<ReturnType<ListeningMissionController['commitProgress']>>;
      try {
        result = await controller.commitProgress(progressResult);
      } catch {
        result = { status: 'error' };
      } finally {
        if (generation === progressGenerationRef.current) progressPendingRef.current = false;
      }

      if (!mountedRef.current || generation !== progressGenerationRef.current) return false;
      if (result.status === 'saved') {
        setProgressStatus('saved');
        setProgressFailureOrigin(undefined);
        progressSavedRef.current = true;
        dispatch({ type: 'progress-save-succeeded' });
        return true;
      }
      setProgressStatus('error');
      setProgressFailureOrigin(origin);
      dispatch({ type: 'progress-save-failed', origin });
      return false;
    },
    [controller, ensureProgressPayload]
  );

  useEffect(() => {
    if (view.phase !== 'results' || resultsCommitStartedRef.current) return;
    resultsCommitStartedRef.current = true;
    void commitProgress('results');
  }, [commitProgress, view.phase]);

  const completeEnd = useCallback(
    (destination: EndDestination) => {
      releaseOwnership();
      if (destination === 'next-mission') onNextMission();
      else onExit();
    },
    [onExit, onNextMission, releaseOwnership]
  );

  const endSession = useCallback(
    async (
      mode: Parameters<ListeningMissionController['endSession']>[0],
      destination: EndDestination
    ) => {
      if (endPendingRef.current) return;
      setLastEndRequest({ mode, destination });
      const generation = ++endGenerationRef.current;
      endPendingRef.current = true;
      setEndPending(true);
      setEndError(false);
      let result: Awaited<ReturnType<ListeningMissionController['endSession']>>;
      try {
        result = await controller.endSession(mode);
      } catch {
        result = { status: 'error' };
      } finally {
        if (generation === endGenerationRef.current) endPendingRef.current = false;
      }

      if (!mountedRef.current || generation !== endGenerationRef.current) return;
      setEndPending(false);
      if (result.status === 'error') {
        setEndError(true);
        requestAnimationFrame(() => endRetryRef.current?.focus());
        return;
      }
      completeEnd(destination);
    },
    [completeEnd, controller]
  );

  const retryLastEnd = () => {
    if (!lastEndRequest) return;
    void endSession(lastEndRequest.mode, lastEndRequest.destination);
  };

  const openExit = () => {
    if (
      view.phase === 'results' &&
      (progressStatus !== 'saved' ||
        difficultPendingRef.current ||
        endPendingRef.current ||
        endError)
    ) {
      return;
    }
    exitOriginRef.current = view.phase === 'results' ? 'results' : 'mid-mission';
    activePlaybackGenerationRef.current += 1;
    pendingReplayTokensRef.current.clear();
    setPendingReplayRates(new Set());
    setPlaybackStatus('idle');
    dispatch({ type: 'exit-opened' });
  };

  const continueMission = () => {
    if (progressPendingRef.current || endPendingRef.current) return;
    setEndError(false);
    setLastEndRequest(undefined);
    restoreExitFocusRef.current = true;
    dispatch({ type: 'exit-cancelled' });
  };

  const saveAndExit = async () => {
    const origin = exitOriginRef.current;
    if (view.completedVisitCount > 0 && !progressSavedRef.current) {
      const saved = await commitProgress(origin);
      if (!saved) return;
    }
    await endSession(origin === 'results' ? 'complete-stay' : 'restore-start', 'exit');
  };

  const retryProgressSaving = async () => {
    const origin = progressFailureOrigin ?? 'mid-mission';
    const saved = await commitProgress(origin);
    if (saved && origin === 'mid-mission') {
      await endSession('restore-start', 'exit');
    }
  };

  const discardProgress = () => {
    if (progressPendingRef.current) return;
    progressGenerationRef.current += 1;
    const mode = progressFailureOrigin === 'results' ? 'complete-stay' : 'restore-start';
    void endSession(mode, 'exit');
  };

  const discardTerminalProgress = () => {
    if (progressPendingRef.current) return;
    progressGenerationRef.current += 1;
    void endSession(terminalEndMode, 'exit');
  };

  const handleResultsEnd = (
    mode: 'complete-stay' | 'continue-watching',
    destination: EndDestination
  ) => {
    if (
      progressStatus !== 'saved' ||
      difficultPendingRef.current ||
      endPendingRef.current ||
      endError
    ) {
      return;
    }
    void endSession(mode, destination);
  };

  const safeTerminalExit = async () => {
    if (
      (progressPayloadRef.current || progressPayloadBuildFailedRef.current) &&
      !progressSavedRef.current
    ) {
      const saved = await commitProgress(
        terminalEndMode === 'complete-stay' ? 'results' : 'mid-mission'
      );
      if (!saved) return;
    }
    await endSession(terminalEndMode, 'exit');
  };

  const applyDifficultResult = useCallback(
    (result: DifficultSaveResult) => {
      dispatch({ type: 'difficult-save-completed', result });
      const busyCount = result.retryableFailures.filter(({ reason }) => reason === 'busy').length;
      const errorCount = result.retryableFailures.length - busyCount;
      setDifficultFeedback({ busyCount, errorCount, savedCount: result.saved.length });

      if (result.terminalFailure) {
        const failedLine = view.difficultCandidates.findIndex(
          ({ segmentKey }) => segmentKey === result.terminalFailure?.segmentKey
        );
        const toLines = (segmentKeys: readonly string[]) =>
          segmentKeys
            .map(
              (segmentKey) =>
                view.difficultCandidates.findIndex(
                  (candidate) => candidate.segmentKey === segmentKey
                ) + 1
            )
            .filter((line) => line > 0);
        invalidate(result.terminalFailure.reason, 'complete-stay', {
          busyLines: toLines(
            result.retryableFailures
              .filter(({ reason }) => reason === 'busy')
              .map(({ segmentKey }) => segmentKey)
          ),
          errorLines: toLines(
            result.retryableFailures
              .filter(({ reason }) => reason === 'error')
              .map(({ segmentKey }) => segmentKey)
          ),
          failedLine: failedLine < 0 ? undefined : failedLine + 1,
          savedLines: toLines([
            ...new Set([
              ...view.difficultCandidates
                .filter(({ saved }) => saved)
                .map(({ segmentKey }) => segmentKey),
              ...result.saved,
            ]),
          ]),
          unattemptedLines: toLines(result.terminalFailure.unattempted),
        });
      } else if (result.retryableFailures.length > 0) {
        requestAnimationFrame(() => difficultSaveRef.current?.focus());
      }
    },
    [invalidate, view.difficultCandidates]
  );

  const saveDifficult = async () => {
    const selected = [...view.selectedDifficultSegmentKeys];
    if (
      selected.length === 0 ||
      difficultPendingRef.current ||
      endPendingRef.current ||
      endError ||
      progressStatus !== 'saved'
    ) {
      return;
    }
    const generation = ++difficultGenerationRef.current;
    difficultPendingRef.current = true;
    setDifficultPending(true);
    setDifficultFeedback(undefined);
    dispatch({ type: 'difficult-save-started' });
    let result: DifficultSaveResult;
    try {
      result = await controller.saveDifficultSegments(selected);
    } catch {
      result = {
        saved: [],
        retryableFailures: selected.map((segmentKey) => ({ segmentKey, reason: 'error' })),
      };
    } finally {
      if (generation === difficultGenerationRef.current) difficultPendingRef.current = false;
    }

    if (!mountedRef.current || generation !== difficultGenerationRef.current) return;
    setDifficultPending(false);
    applyDifficultResult(
      normalizeDifficultResult(
        result,
        selected,
        view.difficultCandidates.map(({ segmentKey }) => segmentKey)
      )
    );
  };

  const submitAnswer = () => {
    dispatch({ type: 'answer-submitted' });
    requestAnimationFrame(() => answerRef.current?.focus());
  };

  if (view.phase === 'terminal-invalidation') {
    return (
      <MissionShell>
        <div
          ref={terminalRef}
          role='alert'
          tabIndex={-1}
          className='flex min-w-0 flex-col gap-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 outline-none'
        >
          <div className='flex min-w-0 items-start gap-2'>
            <AlertTriangleIcon className='mt-0.5 size-5 shrink-0 text-destructive' aria-hidden='true' />
            <div className='min-w-0 space-y-1 text-wrap'>
              <h1 className='font-semibold'>{t('v2_listening_mission_terminal_title')}</h1>
              <p className='text-sm'>{terminalReasonText(view.terminalReason)}</p>
              {terminalDetail?.failedLine !== undefined && (
                <p className='text-sm'>
                  {t(
                    'v2_listening_mission_difficult_terminal_failed',
                    String(terminalDetail.failedLine)
                  )}
                </p>
              )}
              {terminalDetail?.savedLines.map((line) => (
                <p key={`saved-${line}`} className='text-sm'>
                  {t('v2_listening_mission_difficult_terminal_saved_line', String(line))}
                </p>
              ))}
              {terminalDetail?.busyLines.map((line) => (
                <p key={`busy-${line}`} className='text-sm'>
                  {t('v2_listening_mission_difficult_terminal_busy_line', String(line))}
                </p>
              ))}
              {terminalDetail?.errorLines.map((line) => (
                <p key={`error-${line}`} className='text-sm'>
                  {t('v2_listening_mission_difficult_terminal_error_line', String(line))}
                </p>
              ))}
              {terminalDetail?.unattemptedLines.map((line) => (
                <p key={`unattempted-${line}`} className='text-sm'>
                  {t('v2_listening_mission_difficult_terminal_unattempted_line', String(line))}
                </p>
              ))}
            </div>
          </div>
          <EndAction
            ref={endRetryRef}
            endError={endError}
            endPending={endPending || progressStatus === 'saving'}
            label={t(
              endError
                ? 'v2_listening_mission_retry_ending'
                : progressStatus === 'error'
                  ? 'v2_listening_mission_retry_saving'
                  : 'v2_listening_mission_safe_exit'
            )}
            onClick={endError ? retryLastEnd : () => void safeTerminalExit()}
          />
          {progressStatus === 'saving' && (
            <p role='status' className='text-sm'>
              {t('v2_listening_mission_progress_saving')}
            </p>
          )}
          {progressStatus === 'error' && !endError && (
            <div className='space-y-3 rounded-md border border-destructive/30 p-3 text-wrap'>
              <p role='alert' className='text-sm text-destructive'>
                {t('v2_listening_mission_progress_unsaved')}
              </p>
              <p className='text-sm'>{t('v2_listening_mission_unsaved_lost')}</p>
              <Button
                className={`${ACTION_CLASS} w-full`}
                variant='outline'
                disabled={endPending}
                onClick={discardTerminalProgress}
              >
                {t('v2_listening_mission_exit_without_saving')}
              </Button>
            </div>
          )}
        </div>
      </MissionShell>
    );
  }

  if (view.phase === 'progress-save-failure') {
    return (
      <MissionShell>
        <section className='flex min-w-0 flex-col gap-4' aria-labelledby='progress-failure-title'>
          <div className='space-y-2 text-wrap'>
            <h1
              ref={phaseHeadingRef}
              id='progress-failure-title'
              tabIndex={-1}
              className='text-lg font-semibold outline-none'
            >
              {t('v2_listening_mission_progress_failed_title')}
            </h1>
            <p className='text-sm text-muted-foreground'>
              {t('v2_listening_mission_progress_failed_description')}
            </p>
            <p role='alert' className='text-sm font-medium text-destructive'>
              {t('v2_listening_mission_progress_unsaved')}
            </p>
          </div>
          {!endError && (
            <>
              <Button
                ref={progressRetryRef}
                className={ACTION_CLASS}
                disabled={progressStatus === 'saving'}
                onClick={() => void retryProgressSaving()}
              >
                <RotateCcwIcon aria-hidden='true' />
                {t('v2_listening_mission_retry_saving')}
              </Button>
              <div className='rounded-md border border-destructive/30 bg-destructive/10 p-3 text-wrap text-sm'>
                <p>{t('v2_listening_mission_unsaved_lost')}</p>
                <Button
                  className={`${ACTION_CLASS} mt-3 w-full`}
                  variant='outline'
                  disabled={endPending || progressStatus === 'saving'}
                  onClick={discardProgress}
                >
                  {t('v2_listening_mission_exit_without_saving')}
                </Button>
              </div>
            </>
          )}
          {progressStatus === 'saving' && (
            <p role='status' className='text-wrap text-sm'>
              {t('v2_listening_mission_progress_saving')}
            </p>
          )}
          {endError && (
            <EndAction
              ref={endRetryRef}
              endError
              endPending={endPending}
              label={t('v2_listening_mission_retry_ending')}
              onClick={retryLastEnd}
            />
          )}
        </section>
      </MissionShell>
    );
  }

  return (
    <MissionShell>
      <div className='flex min-w-0 items-center justify-between gap-3'>
        <h1 className='min-w-0 text-lg font-semibold text-wrap'>
          {t('v2_listening_mission_title')}
        </h1>
        <Button
          ref={exitTriggerRef}
          type='button'
          className={`${ACTION_CLASS} shrink-0`}
          variant='ghost'
          disabled={
            endPending ||
            difficultPending ||
            endError ||
            (view.phase === 'results' && progressStatus !== 'saved')
          }
          onClick={openExit}
        >
          <XIcon aria-hidden='true' />
          {t('v2_listening_mission_exit')}
        </Button>
      </div>

      {view.activeRound && view.activeSegment ? (
        <ActiveLine
          answerId={answerId}
          answerRef={answerRef}
          currentCombo={view.currentCombo}
          openedHints={view.openedHints}
          draft={view.draft}
          judgment={view.judgment}
          lineState={view.lineState}
          linePosition={view.roundPosition}
          lineTotal={view.roundTotal}
          nextHint={view.nextHint}
          pendingReplayRates={pendingReplayRates}
          playbackStatus={playbackStatus}
          retryRound={view.activeRound === 'retry'}
          segment={view.activeSegment}
          answerVisible={view.answerVisible}
          nextRef={nextRef}
          onDraftChange={(draft) => dispatch({ type: 'draft-updated', draft })}
          onHint={() => dispatch({ type: 'hint-requested' })}
          onLater={() => dispatch({ type: 'later-chosen' })}
          onListen={(rate) => void playSegment(rate)}
          onNext={() => dispatch({ type: 'next-chosen' })}
          onSubmit={submitAnswer}
          onCompositionChange={(composing) => {
            const generation = compositionGuardGenerationRef.current + 1;
            compositionGuardGenerationRef.current = generation;
            isComposingRef.current = composing;
            suppressNextCompositionEnterRef.current = !composing;
            if (!composing) {
              requestAnimationFrame(() => {
                if (compositionGuardGenerationRef.current === generation) {
                  suppressNextCompositionEnterRef.current = false;
                }
              });
            }
          }}
          isComposingRef={isComposingRef}
          suppressNextCompositionEnterRef={suppressNextCompositionEnterRef}
        />
      ) : view.phase === 'first-round-summary' ? (
        <section className='flex min-w-0 flex-col gap-4' aria-labelledby='mission-summary-title'>
          <h2
            ref={phaseHeadingRef}
            id='mission-summary-title'
            tabIndex={-1}
            className='text-lg font-semibold outline-none'
          >
            {t('v2_listening_mission_summary_title')}
          </h2>
          <dl className='grid min-w-0 gap-2 rounded-lg border p-3 text-wrap text-sm'>
            <ResultRow
              label={t('v2_listening_mission_summary_exact', String(view.firstSubmissionExactCount))}
            />
            <ResultRow
              label={t('v2_listening_mission_summary_retry', String(view.retryCandidateCount))}
            />
            <ResultRow label={t('v2_listening_mission_best_combo', String(view.bestCombo))} />
          </dl>
          <div className='grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2'>
            <Button
              className={ACTION_CLASS}
              onClick={() => dispatch({ type: 'retry-started' })}
            >
              {t('v2_listening_mission_retry_lines', String(view.retryCandidateCount))}
            </Button>
            <Button
              className={ACTION_CLASS}
              variant='outline'
              onClick={() => dispatch({ type: 'results-requested' })}
            >
              {t('v2_listening_mission_view_results')}
            </Button>
          </div>
        </section>
      ) : view.phase === 'results' ? (
        <Results
          difficultFeedback={difficultFeedback}
          difficultPending={difficultPending}
          difficultSaveRef={difficultSaveRef}
          endError={endError}
          endPending={endPending}
          endRetryRef={endRetryRef}
          phaseHeadingRef={phaseHeadingRef}
          progressStatus={progressStatus}
          view={view}
          onClose={() => handleResultsEnd('complete-stay', 'exit')}
          onContinueWatching={() => handleResultsEnd('continue-watching', 'exit')}
          onNextMission={() => handleResultsEnd('complete-stay', 'next-mission')}
          onSaveDifficult={() => void saveDifficult()}
          onToggleDifficult={(segmentKey) =>
            dispatch({ type: 'difficult-selection-toggled', segmentKey })
          }
          onRetryEnd={retryLastEnd}
        />
      ) : null}

      <p aria-live='polite' role='status' className='sr-only'>
        {playbackStatusText(playbackStatus)}
      </p>

      {view.phase === 'exit-confirmation' && (
        <ExitDialog
          continueRef={continueDialogRef}
          descriptionId={dialogDescriptionId}
          dialogRef={dialogRef}
          endError={endError}
          endPending={endPending}
          endRetryRef={endRetryRef}
          progressPending={progressStatus === 'saving'}
          titleId={dialogTitleId}
          onContinue={continueMission}
          onRetryEnd={retryLastEnd}
          onSaveAndExit={() => void saveAndExit()}
        />
      )}
    </MissionShell>
  );
}

function MissionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden'>
      <div
        className='flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto p-4'
        data-scroll-owner='listening-mission'
      >
        {children}
      </div>
    </div>
  );
}

interface ActiveLineProps {
  answerId: string;
  answerRef: React.RefObject<HTMLTextAreaElement | null>;
  answerVisible: boolean;
  currentCombo: number;
  draft: string;
  isComposingRef: React.RefObject<boolean>;
  suppressNextCompositionEnterRef: React.RefObject<boolean>;
  judgment?: 'correct' | 'almost' | 'try-again';
  lineState: 'answering' | 'correct' | 'revealed';
  linePosition: number;
  lineTotal: number;
  nextHint?: { level: 1 | 2 | 3 | 4; text: string };
  openedHints: ReadonlyArray<{ level: 1 | 2 | 3 | 4; text: string }>;
  nextRef: React.RefObject<HTMLButtonElement | null>;
  pendingReplayRates: ReadonlySet<1 | 0.75>;
  playbackStatus: 'idle' | 'playing' | 'played' | 'error';
  retryRound: boolean;
  segment: {
    answerText: string;
    alignedSupport?: { text: string };
  };
  onCompositionChange: (composing: boolean) => void;
  onDraftChange: (draft: string) => void;
  onHint: () => void;
  onLater: () => void;
  onListen: (rate: 1 | 0.75) => void;
  onNext: () => void;
  onSubmit: () => void;
}

function ActiveLine({
  answerId,
  answerRef,
  answerVisible,
  currentCombo,
  draft,
  isComposingRef,
  suppressNextCompositionEnterRef,
  judgment,
  lineState,
  linePosition,
  lineTotal,
  nextHint,
  nextRef,
  openedHints,
  pendingReplayRates,
  playbackStatus,
  retryRound,
  segment,
  onCompositionChange,
  onDraftChange,
  onHint,
  onLater,
  onListen,
  onNext,
  onSubmit,
}: ActiveLineProps) {
  const feedback = judgmentFeedback(judgment);
  const lineCorrect = lineState === 'correct';
  const lineNeedsRetry = lineState === 'revealed' || judgment !== undefined;
  return (
    <section className='flex min-w-0 flex-col gap-4' aria-labelledby='active-line-round'>
      <div className='flex min-w-0 flex-wrap items-center gap-2 text-sm'>
        <span id='active-line-round' className='font-medium'>
          {t(
            retryRound
              ? 'v2_listening_mission_retry_round'
              : 'v2_listening_mission_first_round'
          )}
        </span>
        <span className='text-muted-foreground'>
          {t(
            'v2_listening_mission_round_progress',
            String(linePosition),
            String(lineTotal)
          )}
        </span>
        {currentCombo > 0 && (
          <span className='rounded-full bg-primary/10 px-2 py-1 font-medium text-primary'>
            {t('v2_listening_mission_combo', String(currentCombo))}
          </span>
        )}
      </div>

      <div className='flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm'>
        {lineCorrect ? (
          <CheckCircle2Icon className='size-4 shrink-0 text-primary' aria-hidden='true' />
        ) : lineNeedsRetry ? (
          <AlertTriangleIcon className='size-4 shrink-0 text-destructive' aria-hidden='true' />
        ) : (
          <CircleDotIcon className='size-4 shrink-0' aria-hidden='true' />
        )}
        <span className='text-wrap'>
          {t(
            lineCorrect
              ? 'v2_listening_mission_line_completed'
              : lineNeedsRetry
                ? 'v2_listening_mission_line_retry'
                : 'v2_listening_mission_line_current'
          )}
        </span>
      </div>

      <p className='text-wrap text-sm'>{t('v2_listening_mission_instruction')}</p>
      <div className='grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2'>
        <Button
          type='button'
          className={ACTION_CLASS}
          variant='outline'
          disabled={pendingReplayRates.has(1)}
          onClick={() => onListen(1)}
        >
          <HeadphonesIcon aria-hidden='true' />
          {t('v2_listening_mission_listen_again')}
        </Button>
        <Button
          type='button'
          className={ACTION_CLASS}
          variant='outline'
          disabled={pendingReplayRates.has(0.75)}
          onClick={() => onListen(0.75)}
        >
          <HeadphonesIcon aria-hidden='true' />
          {t('v2_listening_mission_listen_slow')}
        </Button>
      </div>

      {!answerVisible && (
        <form
          className='flex min-w-0 flex-col gap-3'
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor={answerId} className='text-wrap text-sm font-medium'>
            {t('v2_listening_mission_answer_label')}
          </label>
          <textarea
            ref={answerRef}
            id={answerId}
            value={draft}
            rows={4}
            className='border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground min-h-24 w-full min-w-0 resize-y rounded-md border bg-transparent px-3 py-2 text-wrap shadow-xs outline-none transition-[color,box-shadow] [overflow-wrap:anywhere] focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 motion-reduce:transition-none'
            placeholder={t('v2_listening_mission_answer_placeholder')}
            onChange={(event) => onDraftChange(event.target.value)}
            onCompositionStart={() => onCompositionChange(true)}
            onCompositionEnd={() => onCompositionChange(false)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.shiftKey) {
                if (event.key !== 'Enter') suppressNextCompositionEnterRef.current = false;
                return;
              }
              if (
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229 ||
                isComposingRef.current
              ) {
                return;
              }
              if (suppressNextCompositionEnterRef.current) {
                suppressNextCompositionEnterRef.current = false;
                event.preventDefault();
                return;
              }
              event.preventDefault();
              onSubmit();
            }}
            onKeyUp={() => {
              suppressNextCompositionEnterRef.current = false;
            }}
            onBlur={() => {
              isComposingRef.current = false;
              suppressNextCompositionEnterRef.current = false;
            }}
          />
          <Button type='submit' className={ACTION_CLASS}>
            {t('v2_listening_mission_submit')}
          </Button>
        </form>
      )}

      {openedHints.length > 0 && (
        <div className='min-w-0 space-y-2' aria-live='polite'>
          {openedHints.map((hint) => (
            <section key={hint.level} className='min-w-0 rounded-md border bg-muted/30 p-3'>
              <h2 className='text-sm font-medium'>
                {t('v2_listening_mission_hint_level', String(hint.level))}
              </h2>
              <p className='mt-1 text-wrap [overflow-wrap:anywhere]'>{hint.text}</p>
            </section>
          ))}
        </div>
      )}

      {feedback && (
        <div
          role='status'
          aria-live='polite'
          className='flex min-w-0 items-start gap-2 rounded-md border p-3 text-wrap text-sm'
        >
          {feedback.icon}
          <span>{feedback.text}</span>
        </div>
      )}

      {answerVisible ? (
        <div className='flex min-w-0 flex-col gap-3'>
          <section className='min-w-0 rounded-md border bg-primary/5 p-3'>
            <h2 className='text-sm font-medium'>{t('v2_listening_mission_answer_heading')}</h2>
            <p className='mt-1 text-wrap [overflow-wrap:anywhere]'>{segment.answerText}</p>
            {segment.alignedSupport && (
              <div className='mt-3 border-t pt-3'>
                <h3 className='text-sm font-medium'>
                  {t('v2_listening_mission_support_heading')}
                </h3>
                <p className='mt-1 text-wrap text-muted-foreground [overflow-wrap:anywhere]'>
                  {segment.alignedSupport.text}
                </p>
              </div>
            )}
          </section>
          <Button ref={nextRef} type='button' className={ACTION_CLASS} onClick={onNext}>
            {t('v2_listening_mission_next')}
          </Button>
        </div>
      ) : (
        <div className='grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2'>
          {nextHint && (
            <Button type='button' className={ACTION_CLASS} variant='outline' onClick={onHint}>
              {nextHint.level === 4
                ? t('v2_listening_mission_reveal')
                : t('v2_listening_mission_hint')}
            </Button>
          )}
          <Button type='button' className={ACTION_CLASS} variant='ghost' onClick={onLater}>
            {t('v2_listening_mission_later')}
          </Button>
        </div>
      )}

      {playbackStatus === 'error' && (
        <p role='status' className='text-wrap text-sm text-destructive'>
          {t('v2_listening_mission_playback_error')}
        </p>
      )}
    </section>
  );
}

function Results({
  difficultFeedback,
  difficultPending,
  difficultSaveRef,
  endError,
  endPending,
  endRetryRef,
  phaseHeadingRef,
  progressStatus,
  view,
  onClose,
  onContinueWatching,
  onNextMission,
  onSaveDifficult,
  onToggleDifficult,
  onRetryEnd,
}: {
  difficultFeedback?: DifficultFeedback;
  difficultPending: boolean;
  difficultSaveRef: React.RefObject<HTMLButtonElement | null>;
  endError: boolean;
  endPending: boolean;
  endRetryRef: React.RefObject<HTMLButtonElement | null>;
  phaseHeadingRef: React.RefObject<HTMLHeadingElement | null>;
  progressStatus: ProgressStatus;
  view: ReturnType<typeof selectListeningMissionView>;
  onClose: () => void;
  onContinueWatching: () => void;
  onNextMission: () => void;
  onSaveDifficult: () => void;
  onToggleDifficult: (segmentKey: string) => void;
  onRetryEnd: () => void;
}) {
  const progressResolved = progressStatus === 'saved';
  const difficultDisabled = difficultPending || endPending || !progressResolved || endError;
  const endActionsDisabled = endPending || difficultPending || !progressResolved || endError;

  return (
    <section className='flex min-w-0 flex-col gap-4' aria-labelledby='mission-results-title'>
      <div className='text-center'>
        <h2
          ref={phaseHeadingRef}
          id='mission-results-title'
          tabIndex={-1}
          className='text-xl font-semibold outline-none'
        >
          {t('v2_listening_mission_results_title')}
        </h2>
        <p className='mt-2 text-lg font-semibold'>
          <span aria-hidden='true'>{'★'.repeat(view.result.stars)}</span>
          <span className='sr-only'>{t('v2_listening_mission_stars', String(view.result.stars))}</span>
        </p>
        {view.result.perfect && (
          <p className='mt-1 inline-flex items-center gap-1 font-medium text-primary'>
            <SparklesIcon aria-hidden='true' />
            {t('v2_listening_mission_perfect')}
          </p>
        )}
      </div>

      <dl className='grid min-w-0 gap-2 rounded-lg border p-3 text-wrap text-sm'>
        <ResultRow
          label={t(
            'v2_listening_mission_results_cleared',
            String(view.result.clearedCount),
            String(view.result.segmentCount)
          )}
        />
        <ResultRow
          label={t(
            'v2_listening_mission_results_first_exact',
            String(view.result.firstSubmissionExactCount)
          )}
        />
        <ResultRow
          label={t(
            'v2_listening_mission_results_hint_free',
            String(view.hintFreeCorrectCount)
          )}
        />
        <ResultRow
          label={t(
            'v2_listening_mission_results_retry',
            String(view.retrySuccessCount),
            String(view.retryAttemptedCount)
          )}
        />
        <ResultRow label={t('v2_listening_mission_best_combo', String(view.bestCombo))} />
      </dl>

      <p role='status' aria-live='polite' className='text-wrap text-sm font-medium'>
        {progressStatus === 'saving'
          ? t('v2_listening_mission_progress_saving')
          : progressStatus === 'saved'
            ? t('v2_listening_mission_progress_saved')
            : t('v2_listening_mission_progress_unsaved')}
      </p>

      {view.difficultCandidates.length > 0 && (
        <section className='min-w-0 space-y-3 rounded-lg border p-3' aria-labelledby='difficult-title'>
          <div className='space-y-1 text-wrap'>
            <h3 id='difficult-title' className='font-semibold'>
              {t('v2_listening_mission_difficult_title')}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {t('v2_listening_mission_difficult_description')}
            </p>
          </div>
          <div className='space-y-2'>
            {view.difficultCandidates.map((candidate, index) => (
              <label
                key={candidate.segmentKey}
                className='flex min-h-11 min-w-0 items-start gap-3 rounded-md border p-3 text-wrap'
              >
                <input
                  type='checkbox'
                  className='mt-0.5 size-5 shrink-0'
                  checked={view.selectedDifficultSegmentKeys.includes(candidate.segmentKey)}
                  disabled={difficultDisabled}
                  aria-label={t('v2_listening_mission_difficult_checkbox', String(index + 1))}
                  onChange={() => onToggleDifficult(candidate.segmentKey)}
                />
                <span className='min-w-0 [overflow-wrap:anywhere]'>
                  <span className='block'>{candidate.answerText}</span>
                  {candidate.supportText && (
                    <span className='mt-1 block text-sm text-muted-foreground'>
                      {candidate.supportText}
                    </span>
                  )}
                  {candidate.retryableFailure && (
                    <span className='mt-1 block text-sm font-medium text-destructive'>
                      {t(
                        candidate.retryableFailure === 'busy'
                          ? 'v2_listening_mission_difficult_row_busy'
                          : 'v2_listening_mission_difficult_row_error'
                      )}
                    </span>
                  )}
                  {candidate.saved && (
                    <span className='mt-1 block text-sm font-medium text-primary'>
                      {t('v2_listening_mission_difficult_row_saved')}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
          <Button
            ref={difficultSaveRef}
            type='button'
            className={`${ACTION_CLASS} w-full`}
            disabled={difficultDisabled || view.selectedDifficultSegmentKeys.length === 0}
            onClick={onSaveDifficult}
          >
            {difficultPending
              ? t('v2_listening_mission_difficult_saving')
              : t('v2_listening_mission_save_selected')}
          </Button>
          {difficultFeedback && (
            <div role='status' aria-live='polite' className='space-y-1 text-wrap text-sm'>
              {difficultFeedback.savedCount > 0 && (
                <p>{t('v2_listening_mission_difficult_saved')}</p>
              )}
              {difficultFeedback.busyCount > 0 && (
                <p>{t('v2_listening_mission_difficult_busy')}</p>
              )}
              {difficultFeedback.errorCount > 0 && (
                <p>{t('v2_listening_mission_difficult_error')}</p>
              )}
            </div>
          )}
        </section>
      )}

      <div className='grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2'>
        <Button className={ACTION_CLASS} disabled={endActionsDisabled} onClick={onNextMission}>
          {t('v2_listening_mission_next_10')}
        </Button>
        <Button
          className={ACTION_CLASS}
          variant='outline'
          disabled={endActionsDisabled}
          onClick={onContinueWatching}
        >
          {t('v2_listening_mission_continue_watching')}
        </Button>
        <Button
          className={`${ACTION_CLASS} min-[360px]:col-span-2`}
          variant='ghost'
          disabled={endActionsDisabled}
          onClick={onClose}
        >
          {t('v2_listening_mission_close')}
        </Button>
      </div>
      {endError && (
        <EndAction
          ref={endRetryRef}
          endError
          endPending={endPending}
          label={t('v2_listening_mission_retry_ending')}
          onClick={onRetryEnd}
        />
      )}
    </section>
  );
}

function ExitDialog({
  continueRef,
  descriptionId,
  dialogRef,
  endError,
  endPending,
  endRetryRef,
  progressPending,
  titleId,
  onContinue,
  onRetryEnd,
  onSaveAndExit,
}: {
  continueRef: React.RefObject<HTMLButtonElement | null>;
  descriptionId: string;
  dialogRef: React.RefObject<HTMLDivElement | null>;
  endError: boolean;
  endPending: boolean;
  endRetryRef: React.RefObject<HTMLButtonElement | null>;
  progressPending: boolean;
  titleId: string;
  onContinue: () => void;
  onRetryEnd: () => void;
  onSaveAndExit: () => void;
}) {
  return (
    <div className='fixed inset-0 z-50 flex min-w-0 items-center justify-center bg-black/50 p-4'>
      <div
        ref={dialogRef}
        role='alertdialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className='w-full min-w-0 max-w-sm rounded-lg border bg-background p-4 shadow-lg'
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !endError && !endPending && !progressPending) {
            event.preventDefault();
            onContinue();
          } else if (event.key === 'Tab') {
            trapDialogFocus(event, dialogRef.current);
          }
        }}
      >
        <h2 id={titleId} className='text-lg font-semibold text-wrap'>
          {t('v2_listening_mission_exit_dialog_title')}
        </h2>
        <p id={descriptionId} className='mt-2 text-wrap text-sm text-muted-foreground'>
          {t('v2_listening_mission_exit_dialog_description')}
        </p>
        {!endError && (
          <div className='mt-4 grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2'>
            <Button
              ref={continueRef}
              type='button'
              className={ACTION_CLASS}
              variant='outline'
              disabled={endPending || progressPending}
              onClick={onContinue}
            >
              {t('v2_listening_mission_continue_mission')}
            </Button>
            <Button
              type='button'
              className={ACTION_CLASS}
              disabled={endPending || progressPending}
              onClick={onSaveAndExit}
            >
              {progressPending
                ? t('v2_listening_mission_progress_saving')
                : t('v2_listening_mission_save_and_exit')}
            </Button>
          </div>
        )}
        {endPending && (
          <p role='status' className='mt-3 text-wrap text-sm'>
            {t('v2_listening_mission_ending')}
          </p>
        )}
        {endError && (
          <EndAction
            ref={endRetryRef}
            endError
            endPending={endPending}
            label={t('v2_listening_mission_retry_ending')}
            onClick={onRetryEnd}
          />
        )}
      </div>
    </div>
  );
}

const EndAction = forwardRef<HTMLButtonElement, {
  endError: boolean;
  endPending: boolean;
  label: string;
  onClick: () => void;
}>(function EndAction(
  {
    endError,
    endPending,
    label,
    onClick,
  },
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <div className='space-y-2 text-wrap'>
      {endError && (
        <p role='alert' className='text-sm text-destructive'>
          {t('v2_listening_mission_end_error')}
        </p>
      )}
      <Button
        ref={ref}
        type='button'
        className={`${ACTION_CLASS} w-full`}
        disabled={endPending}
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );
});

function ResultRow({ label }: { label: string }) {
  return (
    <div className='min-w-0'>
      <dt className='sr-only'>{label}</dt>
      <dd className='text-wrap [overflow-wrap:anywhere]'>{label}</dd>
    </div>
  );
}

const normalizeDifficultResult = (
  result: DifficultSaveResult,
  requestedSegmentKeys: readonly string[],
  candidateSegmentKeys: readonly string[]
): DifficultSaveResult => {
  const candidates = new Set(candidateSegmentKeys);
  const requested = new Set(requestedSegmentKeys.filter((key) => candidates.has(key)));
  const savedSeen = new Set<string>();
  const saved = result.saved.filter((key) => {
    if (!requested.has(key) || savedSeen.has(key)) return false;
    savedSeen.add(key);
    return true;
  });
  const rawTerminalFailure = result.terminalFailure;
  const terminalFailure =
    rawTerminalFailure !== undefined &&
    requested.has(rawTerminalFailure.segmentKey) &&
    !savedSeen.has(rawTerminalFailure.segmentKey)
      ? rawTerminalFailure
      : undefined;
  const failureSeen = new Set<string>();
  const retryableFailures = result.retryableFailures.filter(({ segmentKey }) => {
    if (
      !requested.has(segmentKey) ||
      savedSeen.has(segmentKey) ||
      segmentKey === terminalFailure?.segmentKey ||
      failureSeen.has(segmentKey)
    ) {
      return false;
    }
    failureSeen.add(segmentKey);
    return true;
  });
  if (terminalFailure === undefined) {
    return { saved, retryableFailures };
  }

  const unattemptedSeen = new Set<string>();
  return {
    saved,
    retryableFailures,
    terminalFailure: {
      ...terminalFailure,
      unattempted: terminalFailure.unattempted.filter((key) => {
        if (
          !requested.has(key) ||
          key === terminalFailure.segmentKey ||
          savedSeen.has(key) ||
          failureSeen.has(key) ||
          unattemptedSeen.has(key)
        ) {
          return false;
        }
        unattemptedSeen.add(key);
        return true;
      }),
    },
  };
};

const playbackStatusText = (status: 'idle' | 'playing' | 'played' | 'error') => {
  if (status === 'playing') return t('v2_listening_mission_playing');
  if (status === 'played') return t('v2_listening_mission_played');
  if (status === 'error') return t('v2_listening_mission_playback_error');
  return '';
};

const terminalReasonText = (reason: ListeningTerminalReason | undefined) => {
  if (reason === 'no-video') return t('v2_listening_mission_terminal_no_video');
  if (reason === 'segment-unavailable') {
    return t('v2_listening_mission_terminal_segment_unavailable');
  }
  return t('v2_listening_mission_terminal_stale');
};

const judgmentFeedback = (judgment: 'correct' | 'almost' | 'try-again' | undefined) => {
  if (judgment === 'correct') {
    return {
      icon: <CheckCircle2Icon className='size-5 shrink-0 text-primary' aria-hidden='true' />,
      text: t('v2_listening_mission_correct'),
    };
  }
  if (judgment === 'almost') {
    return {
      icon: <CircleDotIcon className='size-5 shrink-0 text-primary' aria-hidden='true' />,
      text: t('v2_listening_mission_almost'),
    };
  }
  if (judgment === 'try-again') {
    return {
      icon: <AlertTriangleIcon className='size-5 shrink-0 text-destructive' aria-hidden='true' />,
      text: t('v2_listening_mission_try_again'),
    };
  }
  return undefined;
};

const trapDialogFocus = (event: React.KeyboardEvent, dialog: HTMLElement | null) => {
  if (!dialog) return;
  const controls = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), textarea:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  );
  if (controls.length === 0) return;
  const first = controls[0];
  const last = controls.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
