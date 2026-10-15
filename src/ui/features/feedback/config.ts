declare const __FEEDBACK_CONFIG__: { origin: string; privacyUrl: string };

// Replaced at build time. Unconfigured builds never request feedback permissions.
export const feedbackConfig = typeof __FEEDBACK_CONFIG__ === 'undefined'
  ? { origin: '', privacyUrl: '' }
  : __FEEDBACK_CONFIG__;
