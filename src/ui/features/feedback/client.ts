import { z } from 'zod';

import { feedbackConfig } from './config';

const receiptSchema = z.object({
  requestId: z.string().uuid(),
  receivedAt: z.string().datetime(),
  status: z.literal('stored'),
}).strict();

export type FeedbackError = 'feedback_unavailable' | 'feedback_permission_denied' | 'feedback_rate_limited' | 'feedback_failed';

export class FeedbackSubmissionError extends Error {
  constructor(public readonly key: FeedbackError) { super(key); }
}

// Call synchronously from the send gesture, before any await.
export function requestFeedbackPermission() {
  if (!feedbackConfig.origin || !feedbackConfig.privacyUrl) {
    return Promise.reject(new FeedbackSubmissionError('feedback_unavailable'));
  }
  return chrome.permissions.request({ origins: [`${feedbackConfig.origin}/*`] });
}

export async function sendFeedback(message: string, requestId: string, permitted: Promise<boolean>) {
  if (!await permitted) throw new FeedbackSubmissionError('feedback_permission_denied');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${feedbackConfig.origin}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, requestId, extensionVersion: chrome.runtime.getManifest().version }),
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    if (response.status === 429) throw new FeedbackSubmissionError('feedback_rate_limited');
    if (!response.ok) throw new FeedbackSubmissionError('feedback_failed');
    const receipt = receiptSchema.parse(await response.json());
    if (receipt.requestId !== requestId) throw new FeedbackSubmissionError('feedback_failed');
  } finally {
    clearTimeout(timeout);
  }
}
