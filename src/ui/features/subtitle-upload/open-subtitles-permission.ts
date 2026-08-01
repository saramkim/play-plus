export const OPEN_SUBTITLES_OPTIONAL_ORIGINS = [
  'https://api.opensubtitles.com/*',
  'https://www.opensubtitles.com/*',
] as const;

export const requestOpenSubtitlesPermission = () =>
  chrome.permissions.request({ origins: [...OPEN_SUBTITLES_OPTIONAL_ORIGINS] });
