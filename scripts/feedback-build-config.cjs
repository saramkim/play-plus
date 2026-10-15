/* global module */
function getFeedbackConfig(env, production) {
  const origin = env.PLAY_PLUS_FEEDBACK_ORIGIN || '';
  const privacyUrl = env.PLAY_PLUS_FEEDBACK_PRIVACY_URL || '';
  if (!origin && !privacyUrl) return { origin, privacyUrl };
  if (!origin || !privacyUrl) throw new Error('Feedback origin and approved privacy URL must be configured together');
  const api = new URL(origin);
  const privacy = new URL(privacyUrl);
  if (api.protocol !== 'https:' || api.origin !== origin || api.username || api.password || api.hostname.includes('*') ||
      privacy.protocol !== 'https:' || privacy.username || privacy.password) {
    throw new Error('Feedback requires an exact HTTPS origin and HTTPS privacy URL');
  }
  if (production && [api, privacy].some((url) => /(^|\.)(localhost|test|invalid|example|example\.com|example\.org|example\.net)$/.test(url.hostname) || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':'))) {
    throw new Error('Local and placeholder feedback addresses cannot be used in production builds');
  }
  return { origin, privacyUrl };
}
module.exports = { getFeedbackConfig };
