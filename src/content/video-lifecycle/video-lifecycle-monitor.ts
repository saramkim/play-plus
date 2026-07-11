import { getCoupangPlayVideoId } from '@utils/coupang-play';

import { classifyCoupangPlayVideo, VideoCandidateState } from './classifier';
import { observeVideoRoute } from './route-observer';

export type VideoLifecycleState = VideoCandidateState | 'transitioning';
export type VideoLifecycleEvent = {
  state: VideoLifecycleState;
  video: HTMLVideoElement | null;
  videoId: string | null;
  delayed: boolean;
};

type RouteSubscription = { check(): void; remove(): void };
type ObserveRoute = (onChange: (videoId: string | null) => void) => RouteSubscription;

const MEDIA_EVENTS = ['loadedmetadata', 'canplay', 'emptied', 'durationchange', 'error'] as const;
const DETECTION_DELAY_MS = 30_000;

export class VideoLifecycleMonitor {
  private callback: ((event: VideoLifecycleEvent) => void) | null = null;
  private observer: MutationObserver | null = null;
  private routeSubscription: RouteSubscription | null = null;
  private currentVideoId = getCoupangPlayVideoId(location.href);
  private previousEvent: VideoLifecycleEvent | null = null;
  private transitionVideo: HTMLVideoElement | null = null;
  private transitionSource = '';
  private scheduled = false;
  private delayedTimer: number | null = null;
  private started = false;

  constructor(
    private readonly root: Document = document,
    private readonly observeRoute: ObserveRoute = observeVideoRoute
  ) {}

  start(onChange: (event: VideoLifecycleEvent) => void) {
    if (this.started) return;
    this.started = true;
    this.callback = onChange;
    this.observer = new MutationObserver(this.scheduleRefresh);
    this.observer.observe(this.root.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
    for (const event of MEDIA_EVENTS) this.root.addEventListener(event, this.scheduleRefresh, true);
    this.routeSubscription = this.observeRoute(this.handleRouteChange);
    this.refresh();
  }

  refresh(): VideoLifecycleEvent {
    const classification = classifyCoupangPlayVideo(this.root);
    const source = classification.video?.currentSrc || classification.video?.src || '';
    const isStaleTransitionVideo =
      classification.state === 'content' &&
      classification.video === this.transitionVideo &&
      source === this.transitionSource;

    if (this.transitionVideo && !isStaleTransitionVideo) {
      this.transitionVideo = null;
      this.transitionSource = '';
    }

    const event: VideoLifecycleEvent = {
      state: isStaleTransitionVideo ? 'transitioning' : classification.state,
      video: isStaleTransitionVideo ? null : classification.video,
      videoId: this.currentVideoId,
      delayed: false,
    };
    this.emit(event);
    return event;
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.observer?.disconnect();
    this.observer = null;
    this.routeSubscription?.remove();
    this.routeSubscription = null;
    for (const event of MEDIA_EVENTS) this.root.removeEventListener(event, this.scheduleRefresh, true);
    this.clearDelayedTimer();
    this.callback = null;
    this.scheduled = false;
  }

  private handleRouteChange = (videoId: string | null) => {
    const classification = classifyCoupangPlayVideo(this.root);
    this.currentVideoId = videoId;
    this.transitionVideo = classification.video;
    this.transitionSource = classification.video?.currentSrc || classification.video?.src || '';
    this.emit({ state: 'transitioning', video: null, videoId, delayed: false });
    this.scheduleRefresh();
  };

  private scheduleRefresh = () => {
    if (!this.started || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.started) this.refresh();
    });
  };

  private emit(event: VideoLifecycleEvent) {
    if (!this.started || this.isDuplicate(event)) return;
    this.previousEvent = event;
    if (event.state === 'content') this.clearDelayedTimer();
    else this.ensureDelayedTimer();
    try {
      this.callback?.(event);
    } catch (error) {
      console.error('Video lifecycle callback failed:', error);
    }
  }

  private isDuplicate(event: VideoLifecycleEvent) {
    return (
      this.previousEvent?.state === event.state &&
      this.previousEvent.video === event.video &&
      this.previousEvent.videoId === event.videoId &&
      this.previousEvent.delayed === event.delayed
    );
  }

  private ensureDelayedTimer() {
    if (this.delayedTimer !== null) return;
    this.delayedTimer = window.setTimeout(() => {
      this.delayedTimer = null;
      if (!this.started || !this.previousEvent || this.previousEvent.state === 'content') return;
      this.emit({ ...this.previousEvent, delayed: true });
    }, DETECTION_DELAY_MS);
  }

  private clearDelayedTimer() {
    if (this.delayedTimer === null) return;
    window.clearTimeout(this.delayedTimer);
    this.delayedTimer = null;
  }
}
