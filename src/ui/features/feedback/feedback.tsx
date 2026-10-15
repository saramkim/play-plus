import { useEffect, useRef, useState } from 'react';

import { t } from '@utils/i18n';

import { Button } from '@/ui/components/button';

import { FeedbackError, FeedbackSubmissionError, requestFeedbackPermission, sendFeedback } from './client';
import { feedbackConfig } from './config';

const DISMISSED_KEY = 'feedbackBannerDismissed';

export function Feedback({ open, onClose, onOpen, onboardingComplete }: {
  open: boolean;
  onClose: () => void;
  onOpen: (trigger: HTMLElement) => void;
  onboardingComplete: boolean;
}) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<FeedbackError | 'feedback_length' | null>(null);
  const busy = useRef(false);
  const composing = useRef(false);
  const attempt = useRef<{ message: string; requestId: string } | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const section = useRef<HTMLElement>(null);
  const confirmation = useRef<HTMLDialogElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const configured = Boolean(feedbackConfig.origin && feedbackConfig.privacyUrl);

  useEffect(() => {
    if (open) {
      (success ? result.current : textarea.current)?.focus();
      section.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open, success]);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  const close = () => {
    if (busy.current) return;
    setMessage('');
    setError(null);
    setSuccess(false);
    attempt.current = null;
    onClose();
  };

  const confirm = () => {
    if (busy.current || composing.current || !configured) return;
    const trimmed = message.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      setError('feedback_length');
      textarea.current?.focus();
      return;
    }
    setError(null);
    confirmation.current?.showModal();
    backButton.current?.focus();
  };

  const returnToDraft = () => {
    confirmation.current?.close();
    sendButton.current?.focus();
  };

  const submit = async () => {
    if (busy.current || composing.current || !confirmation.current?.open) return;
    const trimmed = message.trim();
    busy.current = true;
    confirmation.current.close();
    setPending(true);
    setError(null);
    try {
      const permission = requestFeedbackPermission();
      if (attempt.current?.message !== trimmed) attempt.current = { message: trimmed, requestId: crypto.randomUUID() };
      await sendFeedback(trimmed, attempt.current.requestId, permission);
      setSuccess(true);
      setMessage('');
      dismiss();
    } catch (failure) {
      setError(failure instanceof FeedbackSubmissionError ? failure.key : 'feedback_failed');
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return <section ref={section} aria-label={t('feedback_title')} className='min-w-0 whitespace-normal break-words text-sm'>
    {!open && !dismissed && onboardingComplete && configured && <div className='m-3 rounded-md border p-3 flex items-start gap-2'>
      <div className='min-w-0 flex-1'>
        <p className='whitespace-pre-line'>{t('feedback_banner')}</p>
        <Button type='button' variant='outline' size='sm' data-feedback-banner-trigger className='mt-2' onClick={(event) => onOpen(event.currentTarget)}>{t('feedback_open')}</Button>
      </div>
      <button type='button' aria-label={t('feedback_dismiss')} className='shrink-0 px-2' onClick={dismiss}>×</button>
    </div>}
    {open && <div className='m-3 rounded-md border p-3 space-y-3' onKeyDown={(event) => {
      if (event.key === 'Escape' && !event.nativeEvent.isComposing && !composing.current) { event.stopPropagation(); close(); }
    }}>
      <h2 className='font-semibold'>{t('feedback_title')}</h2>
      {success ? <>
        <p ref={result} data-feedback-success tabIndex={-1} role='status'>{t('feedback_success')}</p>
        <Button type='button' onClick={close}>{t('feedback_close')}</Button>
      </> : <>
        {!configured && <p role='status'>{t('feedback_unavailable')}</p>}
        <label htmlFor='feedback-message' className='block'>{t('feedback_message')}</label>
        <textarea id='feedback-message' ref={textarea} rows={4} value={message} disabled={pending}
          aria-describedby={`feedback-count${error ? ' feedback-error' : ''}`}
          aria-invalid={error === 'feedback_length'}
          className='block w-full min-w-0 resize-y rounded border bg-background p-2 select-text'
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          onChange={(event) => { setMessage(event.target.value); setError(null); }} />
        <div className='flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground'>
          <p id='feedback-count'>{message.trim().length}/1,000</p>
          {configured && <a href={feedbackConfig.privacyUrl} target='_blank' rel='noreferrer' className='ml-auto underline'>{t('feedback_privacy')}</a>}
        </div>
        {error && <p id='feedback-error' role='alert'>{t(error)}</p>}
        <p role='status' aria-live='polite'>{pending ? t('feedback_sending') : ''}</p>
        <div className='flex flex-wrap justify-end gap-2'>
          <Button type='button' variant='outline' disabled={pending} onClick={close}>{t('feedback_cancel')}</Button>
          <Button ref={sendButton} type='button' disabled={pending || !configured} onClick={confirm}>{t('feedback_send')}</Button>
        </div>
        <dialog ref={confirmation} aria-labelledby='feedback-confirm-title' aria-describedby='feedback-disclosure'
          className='fixed inset-0 m-auto max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border bg-background p-4 text-foreground shadow-lg backdrop:bg-black/50'
          onCancel={(event) => { event.preventDefault(); returnToDraft(); }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key !== 'Tab') return;
            const buttons = event.currentTarget.querySelectorAll('button');
            const first = buttons[0];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }}>
          <h2 id='feedback-confirm-title' className='font-semibold'>{t('feedback_confirm_title')}</h2>
          <p id='feedback-disclosure' className='mt-3'>{t('feedback_disclosure')}</p>
          <div className='mt-4 flex flex-wrap justify-end gap-2'>
            <Button ref={backButton} type='button' variant='outline' onClick={returnToDraft}>{t('feedback_back')}</Button>
            <Button type='button' onClick={submit}>{t('feedback_confirm_send')}</Button>
          </div>
        </dialog>
      </>}
    </div>}
  </section>;
}
