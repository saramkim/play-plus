import { getCoupangPlayVideoId } from '@utils/coupang-play';

export const observeVideoRoute = (onChange: (videoId: string | null) => void) => {
  let removed = false;
  let currentVideoId = getCoupangPlayVideoId(location.href);
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  const check = () => {
    if (removed) return;
    const nextVideoId = getCoupangPlayVideoId(location.href);
    if (nextVideoId === currentVideoId) return;
    currentVideoId = nextVideoId;
    onChange(nextVideoId);
  };

  const pushState: History['pushState'] = function (this: History, ...args: Parameters<History['pushState']>) {
    originalPushState.apply(this, args);
    check();
  };
  const replaceState: History['replaceState'] = function (this: History, ...args: Parameters<History['replaceState']>) {
    originalReplaceState.apply(this, args);
    check();
  };

  history.pushState = pushState;
  history.replaceState = replaceState;
  window.addEventListener('popstate', check);

  return {
    check,
    remove: () => {
      if (removed) return;
      removed = true;
      if (history.pushState === pushState) history.pushState = originalPushState;
      if (history.replaceState === replaceState) history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', check);
    },
  };
};
