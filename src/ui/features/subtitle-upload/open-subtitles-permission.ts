import {
  OPEN_SUBTITLES_API_ORIGIN,
  OPEN_SUBTITLES_DOWNLOAD_ORIGIN,
} from '@utils/opensubtitles/type';

export const OPEN_SUBTITLES_OPTIONAL_ORIGINS = [
  `${OPEN_SUBTITLES_API_ORIGIN}/*`,
  `${OPEN_SUBTITLES_DOWNLOAD_ORIGIN}/*`,
] as const;

const permissionDetails = { origins: [...OPEN_SUBTITLES_OPTIONAL_ORIGINS] };

export const requestOpenSubtitlesPermission = async () => {
  try {
    return await chrome.permissions.request(permissionDetails);
  } catch {
    return false;
  }
};
