const VIDEO_ID_REGEX = /\/play\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

export const getCoupangPlayVideoId = (url?: string | null): string | null => {
  if (!url) return null;

  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== 'www.coupangplay.com') return null;
    const match = pathname.match(VIDEO_ID_REGEX);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};
