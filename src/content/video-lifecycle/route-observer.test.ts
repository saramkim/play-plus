import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/coupang-play', () => ({
  getCoupangPlayVideoId: (url: string) => url.match(/\/play\/([^/?]+)/)?.[1] ?? null,
}));

import { observeVideoRoute } from './route-observer';

const FIRST_ID = '123e4567-e89b-12d3-a456-426614174000';
const NEXT_ID = '223e4567-e89b-12d3-a456-426614174000';

describe('observeVideoRoute', () => {
  afterEach(() => {
    history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('reports pushState video-id changes exactly once', () => {
    history.replaceState({}, '', `/en/play/${FIRST_ID}/episode`);
    const changes: Array<string | null> = [];
    const subscription = observeVideoRoute((videoId) => changes.push(videoId));

    history.pushState({}, '', `/en/play/${NEXT_ID}/episode`);
    history.pushState({}, '', `/en/play/${NEXT_ID}/episode?source=next`);

    expect(changes).toEqual([NEXT_ID]);
    subscription.remove();
  });

  it('reports replaceState and popstate changes', () => {
    history.replaceState({}, '', `/play/${FIRST_ID}`);
    const changes: Array<string | null> = [];
    const subscription = observeVideoRoute((videoId) => changes.push(videoId));

    history.replaceState({}, '', `/play/${NEXT_ID}`);
    history.replaceState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(changes).toEqual([NEXT_ID, null]);
    subscription.remove();
  });

  it('restores history methods and removes the popstate listener', () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const callback = vi.fn();
    const subscription = observeVideoRoute(callback);

    subscription.remove();

    expect(history.pushState).toBe(originalPushState);
    expect(history.replaceState).toBe(originalReplaceState);
    history.pushState({}, '', `/play/${NEXT_ID}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(callback).not.toHaveBeenCalled();
  });
});
