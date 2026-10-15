import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const { getFeedbackConfig } = createRequire(import.meta.url)('./feedback-build-config.cjs');
describe('feedback deployment configuration', () => {
  it('has no feedback permissions or destinations by default', () => {
    expect(getFeedbackConfig({}, true)).toEqual({ origin: '', privacyUrl: '' });
  });
  it.each(['http://host.test', 'https://host.test/path', 'https://user:pass@host.test', 'https://host.test/', 'https://*.host.test'])('rejects unsafe origin %s', (origin) => {
    expect(() => getFeedbackConfig({ PLAY_PLUS_FEEDBACK_ORIGIN: origin, PLAY_PLUS_FEEDBACK_PRIVACY_URL: 'https://privacy.test' }, true)).toThrow();
  });
  it('requires a policy and rejects local addresses in production', () => {
    expect(() => getFeedbackConfig({ PLAY_PLUS_FEEDBACK_ORIGIN: 'https://localhost:8787' }, false)).toThrow();
    const env = { PLAY_PLUS_FEEDBACK_ORIGIN: 'https://localhost:8787', PLAY_PLUS_FEEDBACK_PRIVACY_URL: 'https://localhost:8787/privacy' };
    expect(getFeedbackConfig(env, false).origin).toBe(env.PLAY_PLUS_FEEDBACK_ORIGIN);
    expect(() => getFeedbackConfig(env, true)).toThrow();
  });
});
