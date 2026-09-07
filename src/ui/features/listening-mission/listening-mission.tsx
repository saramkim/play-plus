import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { t } from '@utils/i18n';
import { flushSync } from 'react-dom';

import { judgeListeningAnswer } from '@/listening/domain/answer';
import {
  createSubmittedAnswerScaffold,
  type SubmittedAnswerScaffold,
} from '@/listening/domain/submitted-answer-scaffold';
import type { ListeningMissionController } from '@/listening/session/mission-controller';
import type { ListeningMissionSnapshot } from '@/listening/session/mission-snapshot';
import { Button } from '@/ui/components/button';

const ACTION_CLASS = 'min-h-11 h-auto min-w-0 whitespace-normal px-3 py-2 text-wrap';
const PICKER_PAGE_SIZE = 40;

export interface ListeningMissionProps {
  boundContextKey?: string;
  initialSegmentKey?: string;
  snapshot: ListeningMissionSnapshot;
  controller: ListeningMissionController;
  onExit: () => void;
  onOwnershipChange?: (owned: boolean) => void;
}

export function ListeningMission({
  boundContextKey, initialSegmentKey, snapshot, controller, onExit, onOwnershipChange,
}: ListeningMissionProps) {
  const [selectedKey, setSelectedKey] = useState(initialSegmentKey);
  const [picking, setPicking] = useState(!initialSegmentKey);
  const [pickerPage, setPickerPage] = useState(0);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<'exact' | 'different'>();
  const [scaffold, setScaffold] = useState<SubmittedAnswerScaffold>();
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState(false);
  const [blindCompleted, setBlindCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error'>();
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const generation = useRef(0);
  const visibilityGeneration = useRef(0);
  const mounted = useRef(true);
  const endingRef = useRef(false);
  const savingRef = useRef(false);
  const composing = useRef(false);
  const compositionEnded = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const answer = useRef<HTMLTextAreaElement>(null);
  const answerId = useId();
  const selected = snapshot.segments.find(({ segmentKey }) => segmentKey === selectedKey);
  const ownershipCallback = useRef(onOwnershipChange);
  ownershipCallback.current = onOwnershipChange;

  useEffect(() => {
    mounted.current = true;
    ownershipCallback.current?.(true);
    return () => {
      mounted.current = false;
      generation.current += 1;
      ownershipCallback.current?.(false);
    };
  }, []);

  const play = useCallback(async (key: string, rate: 1 | 0.75, blind: boolean) => {
    const request = ++generation.current;
    const visibility = visibilityGeneration.current;
    setPlaying(true);
    setPlayError(false);
    setBlindCompleted(false);
    try {
      const result = await controller.playSegment(key, rate);
      if (!mounted.current || request !== generation.current || endingRef.current) return;
      setPlaying(false);
      if (result.status === 'played') {
        if (blind && visibility === visibilityGeneration.current) {
          setBlindCompleted(true);
          exitButton.current?.focus();
        }
      } else if (result.status !== 'suspended') setPlayError(true);
    } catch {
      if (mounted.current && request === generation.current && !endingRef.current) {
        setPlaying(false);
        setPlayError(true);
      }
    }
  }, [controller]);

  useEffect(() => {
    visibilityGeneration.current += 1;
    setRevealed(false);
    setTyping(false);
    setDraft('');
    setFeedback(undefined);
    setScaffold(undefined);
    setSaveStatus(undefined);
    setBlindCompleted(false);
    heading.current?.focus();
    if (selectedKey) void play(selectedKey, 1, false);
    return () => { generation.current += 1; };
  }, [selectedKey, boundContextKey, play]);

  const exposeText = () => {
    visibilityGeneration.current += 1;
    setBlindCompleted(false);
  };
  const reveal = () => {
    exposeText();
    setRevealed(true);
    setFeedback(undefined);
    setScaffold(undefined);
  };
  const hideAndReplay = (rate: 1 | 0.75 = 1) => {
    if (!selected || endingRef.current) return;
    visibilityGeneration.current += 1;
    flushSync(() => {
      setRevealed(false);
      setTyping(false);
      setFeedback(undefined);
      setScaffold(undefined);
    });
    void play(selected.segmentKey, rate, true);
  };
  const compare = () => {
    if (!selected || !draft.trim() || composing.current || endingRef.current) return;
    exposeText();
    const exact = judgeListeningAnswer(selected.answerText, draft, snapshot.learningLanguage) === 'correct';
    setFeedback(exact ? 'exact' : 'different');
    setScaffold(exact ? undefined : createSubmittedAnswerScaffold({
      expected: selected.answerText, learningLanguage: snapshot.learningLanguage, submitted: draft,
    }));
  };
  const exit = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    generation.current += 1;
    setEnding(true);
    setEndError(false);
    try {
      const result = await controller.endSession('restore-start');
      if (!mounted.current) return;
      if (result.status !== 'error') {
        ownershipCallback.current?.(false);
        onExit();
        return;
      }
    } catch {
      // Keep the session available for a direct restoration retry.
    }
    if (mounted.current) {
      endingRef.current = false;
      setEnding(false);
      setPlaying(false);
      setEndError(true);
      exitButton.current?.focus();
    }
  };
  const save = async () => {
    if (!selected || savingRef.current || endingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveStatus(undefined);
    const key = selected.segmentKey;
    try {
      const result = await controller.saveDifficultSegments([key]);
      if (mounted.current && !endingRef.current) setSaveStatus(result.saved.includes(key) ? 'saved' : 'error');
    } catch {
      if (mounted.current && !endingRef.current) setSaveStatus('error');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const past = [...snapshot.segments].reverse();
  const page = past.slice(pickerPage * PICKER_PAGE_SIZE, (pickerPage + 1) * PICKER_PAGE_SIZE);
  return (
    <section className='flex h-full min-h-0 min-w-0 flex-col overflow-hidden' aria-labelledby='listening-practice-title'>
      <header className='flex shrink-0 flex-wrap items-center justify-between gap-2 border-b p-3'>
        <h1 id='listening-practice-title' ref={heading} tabIndex={-1} className='text-base font-semibold'>{t('v2_listening_landing_title')}</h1>
        <Button ref={exitButton} className={ACTION_CLASS} disabled={ending} variant={blindCompleted ? 'default' : 'outline'} onClick={() => void exit()}>
          {ending ? t('v2_listening_mission_ending') : t('v2_listening_return')}
        </Button>
      </header>
      <div className='min-h-0 min-w-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4' data-scroll-owner='listening-mission'>
        {endError && <p role='alert'>{t('v2_listening_mission_end_error')}</p>}
        {picking ? (
          <div className='space-y-3'>
            <h2 className='font-medium'>{t('v2_listening_landing_continue')}</h2>
            <p className='text-xs text-muted-foreground'>{t('v2_listening_past_description')}</p>
            {selected && <Button className={ACTION_CLASS} variant='outline' onClick={() => setPicking(false)}>{t('cancel')}</Button>}
            <ul className='divide-y'>
              {page.map((segment) => (
                <li key={segment.segmentKey}>
                  <button type='button' disabled={ending} className='min-h-11 w-full space-y-1 py-3 text-left [overflow-wrap:anywhere]' onClick={() => {
                    exposeText(); setSelectedKey(segment.segmentKey); setPicking(false);
                    if (segment.segmentKey === selectedKey) hideAndReplay();
                  }}>
                    <span className='block text-xs tabular-nums text-muted-foreground'>{formatTime(segment.startMs)}–{formatTime(segment.endMs)}</span>
                    <span>{segment.answerText}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className='flex flex-wrap gap-2'>
              <Button className={ACTION_CLASS} disabled={pickerPage === 0 || ending} variant='outline' onClick={() => setPickerPage((value) => value - 1)}>{t('v2_listening_newer_lines')}</Button>
              <Button className={ACTION_CLASS} disabled={(pickerPage + 1) * PICKER_PAGE_SIZE >= past.length || ending} variant='outline' onClick={() => setPickerPage((value) => value + 1)}>{t('v2_listening_older_lines')}</Button>
            </div>
          </div>
        ) : selected ? (
          <>
            <p className='text-xs tabular-nums text-muted-foreground'>{formatTime(selected.startMs)}–{formatTime(selected.endMs)}</p>
            <div role='status' aria-live='polite' className='text-sm'>{playing ? t('v2_listening_playing') : blindCompleted ? t('v2_listening_blind_completed') : t('v2_listening_listen_description')}</div>
            {playError && <p role='alert' className='text-sm text-destructive'>{t('v2_listening_play_error')}</p>}
            {revealed && <div className='space-y-3 rounded-lg border bg-muted/30 p-4 [overflow-wrap:anywhere]' data-testid='revealed-answer'>
              <p lang={snapshot.learningLanguage} className='whitespace-pre-wrap text-lg'>{selected.answerText}</p>
              {selected.alignedSupport && <p className='whitespace-pre-wrap text-sm text-muted-foreground'>{selected.alignedSupport.text}</p>}
            </div>}
            <div className='grid gap-2'>
              {!revealed && <Button className={ACTION_CLASS} disabled={ending} onClick={reveal}>{t('v2_listening_reveal')}</Button>}
              <Button className={ACTION_CLASS} disabled={ending} variant={revealed ? 'default' : 'outline'} onClick={() => hideAndReplay()}>{t('v2_listening_hide_replay')}</Button>
              {revealed && <Button className={ACTION_CLASS} disabled={ending} variant='outline' onClick={() => {
                exposeText();
                void play(selected.segmentKey, 1, false);
              }}>{t('v2_listening_visible_replay')}</Button>}
              <Button className={ACTION_CLASS} disabled={ending} variant='outline' onClick={() => hideAndReplay(0.75)}>{t('v2_listening_hide_slow')}</Button>
            </div>
            {!typing ? <Button className={ACTION_CLASS} disabled={ending} variant='ghost' onClick={() => {
              exposeText(); setTyping(true); requestAnimationFrame(() => answer.current?.focus());
            }}>{t('v2_listening_type_optional')}</Button> : (
              <div className='space-y-2'>
                <label htmlFor={answerId} className='text-sm font-medium'>{t('v2_listening_type_optional')}</label>
                <p id={answerId + '-help'} className='text-xs text-muted-foreground'>{t('v2_listening_compare_description')}</p>
                {scaffold && <p aria-label={t('v2_listening_matched_parts')} className='whitespace-pre-wrap rounded border p-3 [overflow-wrap:anywhere]'><span aria-hidden='true'>{scaffold.visualText}</span><span className='sr-only'>{scaffold.parts.map((part) => part.kind === 'blank' ? t('v2_listening_mission_scaffold_blank', String(part.graphemeCount)) : part.text).join(' ')}</span></p>}
                <textarea ref={answer} id={answerId} aria-describedby={answerId + '-help'} value={draft} disabled={ending} rows={3}
                  className='block min-h-24 w-full min-w-0 resize-y rounded-md border bg-background p-3 text-base'
                  onChange={(event) => setDraft(event.target.value)}
                  onCompositionStart={() => { composing.current = true; }}
                  onCompositionEnd={() => { composing.current = false; compositionEnded.current = true; }}
                  onKeyUp={(event) => { if (event.key === 'Enter') compositionEnded.current = false; }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.shiftKey) return;
                    if (event.nativeEvent.isComposing || composing.current || compositionEnded.current || event.nativeEvent.keyCode === 229) return;
                    event.preventDefault(); compare();
                  }} />
                <Button className={ACTION_CLASS} disabled={ending || !draft.trim()} variant='outline' onClick={compare}>{t('v2_listening_compare')}</Button>
                {feedback && <p role='status' className='text-sm'>{t(feedback === 'exact' ? 'v2_listening_comparison_exact' : 'v2_listening_comparison_different')}</p>}
              </div>
            )}
            <div className='space-y-2 border-t pt-3'>
              <Button className={ACTION_CLASS} disabled={ending || saving} variant='outline' onClick={() => void save()}>{saving ? t('v2_listening_saving_line') : t('v2_listening_save_line')}</Button>
              {saveStatus && <p role={saveStatus === 'error' ? 'alert' : 'status'} className='text-sm'>{t(saveStatus === 'saved' ? 'v2_listening_saved_line' : 'v2_listening_save_error')}</p>}
              <Button className={ACTION_CLASS} disabled={ending || playing || saving} variant='ghost' onClick={() => { exposeText(); setPicking(true); setPickerPage(0); }}>{t('v2_listening_landing_continue')}</Button>
            </div>
          </>
        ) : <p role='status'>{t('v2_listening_landing_current_unavailable')}</p>}
      </div>
    </section>
  );
}
const formatTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
