# Coupang Play Video Lifecycle Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace one-shot Coupang Play video detection with a persistent monitor that ignores advertisements and placeholders, releases stale videos, and automatically attaches each episode's content video.

**Architecture:** Split classification, SPA route observation, and lifecycle observation into focused modules. Start one content-side monitor for the page lifetime; it classifies every relevant DOM, source, media, and route transition and drives `VideoManager` attachment instead of relying on completed-tab messages.

**Tech Stack:** TypeScript 5.8, Chrome Extension Manifest V3, DOM MutationObserver and media events, Zustand 5, Vitest 4 with jsdom.

## Global Constraints

- Play Plus controls and subtitles remain inactive during advertisements.
- Episode transitions display detecting state and reconnect without a manual action.
- `waiting`, `placeholder`, `advertisement`, and `transitioning` are nonterminal; observation continues past 30 seconds.
- Advertisement DOM is the primary signal; duration and source form are diagnostic fallback signals only.
- Do not expand Chrome extension permissions.
- Preserve subtitle metadata cached before content attachment.
- Coalesce duplicate signals and never reinitialize the same connected content video.
- `stop()` must remove every observer, history hook, timer, and media listener.
- Every behavior change follows RED-GREEN-REFACTOR TDD.

---

### Task 1: Pure Coupang Play Video Classifier

**Files:**
- Create: `src/content/video-lifecycle/classifier.ts`
- Create: `src/content/video-lifecycle/classifier.test.ts`
- Modify: `src/utils/constants.ts`

**Interfaces:**
- Consumes: `COUPANG_PLAY_SELECTORS.player` and the observed Coupang DOM.
- Produces: `VideoCandidateState`, `VideoClassification`, and `classifyCoupangPlayVideo(document)`.

- [ ] **Step 1: Add stable selector constants**

Extend `COUPANG_PLAY_SELECTORS` in `src/utils/constants.ts`:

```ts
export const COUPANG_PLAY_SELECTORS = {
  player: '#playerWrapper',
  mainVideo: 'video[data-cy="main-video"]',
  progressBar: 'div.slider',
  advertisement: '[class*="AdOverlay_"]',
} as const;
```

- [ ] **Step 2: Write failing classifier tests**

Create `src/content/video-lifecycle/classifier.test.ts` with separate tests for:

```ts
expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'waiting', video: null });

const video = document.createElement('video');
video.dataset.cy = 'main-video';
player.append(video);
expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'placeholder', video });

video.src = 'https://ads.example.com/ad.mp4';
player.append(Object.assign(document.createElement('div'), { className: 'AdOverlay_adOverlay__hash' }));
expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'advertisement', video });

advertisement.remove();
video.src = 'blob:https://www.coupangplay.com/content';
expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'content', video });
```

Also assert that a video outside `#playerWrapper` is ignored and that short duration alone does not classify content as advertising.

- [ ] **Step 3: Run tests and confirm RED**

Run:

```bash
yarn test:run src/content/video-lifecycle/classifier.test.ts
```

Expected: FAIL because `classifier.ts` does not exist.

- [ ] **Step 4: Implement the pure classifier**

Create `src/content/video-lifecycle/classifier.ts`:

```ts
import { COUPANG_PLAY_SELECTORS } from '@utils/constants';

export type VideoCandidateState = 'waiting' | 'placeholder' | 'advertisement' | 'content';
export type VideoClassification = { state: VideoCandidateState; video: HTMLVideoElement | null };

export const classifyCoupangPlayVideo = (root: Document): VideoClassification => {
  const player = root.querySelector(COUPANG_PLAY_SELECTORS.player);
  const video = player?.querySelector<HTMLVideoElement>(COUPANG_PLAY_SELECTORS.mainVideo) ?? null;
  if (!video) return { state: 'waiting', video: null };

  if (player?.querySelector(COUPANG_PLAY_SELECTORS.advertisement)) {
    return { state: 'advertisement', video };
  }

  if (!(video.currentSrc || video.src)) return { state: 'placeholder', video };
  return { state: 'content', video };
};
```

- [ ] **Step 5: Verify and commit**

Run `yarn test:run src/content/video-lifecycle/classifier.test.ts && yarn type-check && yarn lint`.

Expected: all commands exit 0.

```bash
git add src/utils/constants.ts src/content/video-lifecycle/classifier.ts src/content/video-lifecycle/classifier.test.ts
git commit -m "test(content): characterize Coupang video candidates"
```

### Task 2: Restorable SPA Route Observer

**Files:**
- Create: `src/content/video-lifecycle/route-observer.ts`
- Create: `src/content/video-lifecycle/route-observer.test.ts`

**Interfaces:**
- Consumes: `window.history`, `popstate`, and `getCoupangPlayVideoId(location.href)`.
- Produces: `observeVideoRoute(onChange): { check(): void; remove(): void }`.

- [ ] **Step 1: Write failing route tests**

Create tests that install the observer, call `history.pushState`, `history.replaceState`, and dispatch `PopStateEvent`, then assert the callback receives a changed video ID exactly once. Assert query-only changes with the same video ID do not emit and `remove()` restores the original history methods.

```ts
const changes: Array<string | null> = [];
const subscription = observeVideoRoute((videoId) => changes.push(videoId));
history.pushState({}, '', `/en/play/${NEXT_ID}/episode`);
expect(changes).toEqual([NEXT_ID]);
subscription.remove();
```

- [ ] **Step 2: Run tests and confirm RED**

Run `yarn test:run src/content/video-lifecycle/route-observer.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the observer**

Implement one shared patch with reference-counted subscribers so multiple consumers cannot wrap history repeatedly:

```ts
export const observeVideoRoute = (onChange: (videoId: string | null) => void) => {
  let currentVideoId = getCoupangPlayVideoId(location.href);
  const check = () => {
    const nextVideoId = getCoupangPlayVideoId(location.href);
    if (nextVideoId === currentVideoId) return;
    currentVideoId = nextVideoId;
    onChange(nextVideoId);
  };
  // Wrap pushState/replaceState, listen for popstate, and restore all three in remove().
  return { check, remove };
};
```

The actual implementation stores the original `pushState` and `replaceState`, invokes them with their original `this`, then calls `check()` synchronously.

- [ ] **Step 4: Verify and commit**

Run `yarn test:run src/content/video-lifecycle/route-observer.test.ts && yarn type-check && yarn lint`.

Expected: all commands exit 0.

```bash
git add src/content/video-lifecycle/route-observer.ts src/content/video-lifecycle/route-observer.test.ts
git commit -m "feat(content): observe Coupang SPA video routes"
```

### Task 3: Persistent Video Lifecycle Monitor

**Files:**
- Create: `src/content/video-lifecycle/video-lifecycle-monitor.ts`
- Create: `src/content/video-lifecycle/video-lifecycle-monitor.test.ts`

**Interfaces:**
- Consumes: `classifyCoupangPlayVideo`, `observeVideoRoute`, DOM mutations, and media events.
- Produces: `VideoLifecycleState`, `VideoLifecycleEvent`, and class `VideoLifecycleMonitor` with `start`, `refresh`, and `stop`.

- [ ] **Step 1: Write the placeholder-to-content failing test**

```ts
const monitor = new VideoLifecycleMonitor(document);
const events: VideoLifecycleEvent[] = [];
monitor.start((event) => events.push(event));
player.append(video);
video.src = 'blob:https://www.coupangplay.com/content';
video.dispatchEvent(new Event('loadedmetadata'));
await vi.runAllTicks();
expect(events.at(-1)).toMatchObject({ state: 'content', video });
```

Run the test and confirm it fails because the monitor does not exist.

- [ ] **Step 2: Add advertisement and same-element source-transition tests**

Test this exact sequence:

```ts
empty video -> advertisement overlay + direct MP4 -> overlay removed + blob source on same video
```

Expected effective states: `placeholder`, `advertisement`, `content`. Confirm the same video object is returned for all three states.

- [ ] **Step 3: Add replacement and long-delay tests**

Use fake timers to cover:

```ts
old content -> route ID change -> old wrapper removed -> 45 seconds pass -> new placeholder -> new content
```

Expected: `transitioning` is emitted for the new video ID, observation remains active after 45 seconds, and the new video becomes `content`.

- [ ] **Step 4: Add deduplication and cleanup tests**

Dispatch multiple mutations and media events without changing state; assert only one effective event. Call `stop()`, then assert observer disconnect, route subscription removal, timer cleanup, and no later events.

- [ ] **Step 5: Implement the monitor**

Use this public contract:

```ts
export type VideoLifecycleState = VideoCandidateState | 'transitioning';
export type VideoLifecycleEvent = {
  state: VideoLifecycleState;
  video: HTMLVideoElement | null;
  videoId: string | null;
  delayed: boolean;
};

export class VideoLifecycleMonitor {
  constructor(private readonly root: Document = document) {}
  start(onChange: (event: VideoLifecycleEvent) => void): void;
  refresh(): VideoLifecycleEvent;
  stop(): void;
}
```

Implementation requirements:

- observe `document.body` with `{ childList: true, subtree: true, attributes: true, attributeFilter: ['src'] }`;
- bind `loadedmetadata`, `canplay`, `emptied`, `durationchange`, and `error` using event delegation or tracked video listener cleanup;
- schedule classification with one microtask so related DOM mutations coalesce;
- emit when state, video identity, video ID, or delayed flag changes;
- on route change emit `transitioning` immediately, then classify current DOM;
- start a 30-second delayed-status timer for non-content states without stopping observation;
- make `start()` and `stop()` idempotent.

- [ ] **Step 6: Verify and commit**

Run:

```bash
yarn test:run src/content/video-lifecycle
yarn type-check
yarn lint
```

Expected: all lifecycle tests and static checks pass.

```bash
git add src/content/video-lifecycle
git commit -m "feat(content): monitor Coupang video lifecycle"
```

### Task 4: VideoManager Replacement Safety

**Files:**
- Create: `src/content/core/video/video-manager.test.ts`
- Modify: `src/content/core/video/video-manager.ts`

**Interfaces:**
- Consumes: content videos emitted by `VideoLifecycleMonitor`.
- Produces: idempotent `set(video)`, `clear()`, `get()`, and `isCurrent(video)` behavior.

- [ ] **Step 1: Write failing replacement tests**

Mock `requestVideoFrameCallback` and `cancelVideoFrameCallback`. Assert:

```ts
manager.set(first);
manager.set(second);
expect(first.cancelVideoFrameCallback).toHaveBeenCalledWith(firstCallbackId);
expect(manager.get()).toBe(second);
manager.clear();
expect(second.cancelVideoFrameCallback).toHaveBeenCalled();
expect(manager.get()).toBeNull();
```

Also assert `set(first)` twice does not start two frame loops and `clear()` twice is safe.

- [ ] **Step 2: Run tests and confirm RED**

Run `yarn test:run src/content/core/video/video-manager.test.ts`.

Expected: FAIL because public `clear()` and `isCurrent()` do not exist.

- [ ] **Step 3: Implement replacement-safe methods**

```ts
isCurrent(video: HTMLVideoElement) {
  return this.video === video && video.isConnected;
}

clear() {
  this.stopTimeTracking();
  this.video = null;
  useVideoStore.getState().setHasVideo(false);
}

reset() {
  this.clear();
}
```

Ensure `stopTimeTracking()` cancels callback ID `0` correctly by checking `this.frameCallbackId === null`, not truthiness.

- [ ] **Step 4: Verify and commit**

Run `yarn test:run src/content/core/video/video-manager.test.ts && yarn type-check && yarn lint`.

Expected: all commands exit 0.

```bash
git add src/content/core/video/video-manager.ts src/content/core/video/video-manager.test.ts
git commit -m "fix(content): release replaced video elements"
```

### Task 5: Integrate the Monitor with Content Messaging

**Files:**
- Create: `src/content/message-handler.test.ts`
- Modify: `src/content/index.ts`
- Modify: `src/content/message-handler.ts`
- Modify: `src/content/coupang-play.ts`
- Modify: `src/content/coupang-play.test.ts`

**Interfaces:**
- Consumes: `VideoLifecycleMonitor` events and replacement-safe `VideoManager`.
- Produces: page-lifetime automatic detection and manual refresh recovery.

- [ ] **Step 1: Write failing message-handler integration tests**

Mock the monitor callback and assert:

- `content` attaches video, calls `elementStore.setupContainer()`, sets `detected`, and reports `hasVideo: true`;
- `advertisement` after content clears the manager and content UI, sets `detecting`, and reports `hasVideo: false`;
- `transitioning` clears the old video once;
- new `content` reattaches automatically;
- `detectVideo` calls `monitor.refresh()` and returns success only when the refreshed event is `content`;
- subtitle cache is not cleared during transition.

- [ ] **Step 2: Run tests and confirm RED**

Run `yarn test:run src/content/message-handler.test.ts`.

Expected: FAIL because the current handler still calls one-shot `coupangStrategy.detectVideo()`.

- [ ] **Step 3: Extract one lifecycle event handler**

Implement:

```ts
const handleVideoLifecycle = (event: VideoLifecycleEvent) => {
  if (event.state === 'content' && event.video) {
    if (!videoManager.isCurrent(event.video)) {
      videoManager.set(event.video);
      elementStore.setupContainer();
    }
    useVideoStore.getState().setDetectionStatus('detected');
    reportContentStatus(true);
    return;
  }

  if (videoManager.get()) {
    videoManager.clear();
    elementStore.reset();
    loopController.resetLoop();
  }
  useVideoStore.getState().setDetectionStatus(event.delayed ? 'failed' : 'detecting');
  reportContentStatus(false);
};
```

Do not clear `useSubtitleStore` caches in this transition handler.

- [ ] **Step 4: Start the monitor once**

Create one monitor instance at module scope, start it from content initialization, and stop it only during explicit content-script teardown used by tests.

Replace `initializeVideo()` with `refreshVideoDetection()` that calls `monitor.refresh()` and derives the message response from the returned event.

- [ ] **Step 5: Remove one-shot detection implementation**

Delete `detectVideo()` and its timer/observer implementation from `src/content/coupang-play.ts`. Keep selector getters and subtitle metadata functions. Update its tests so DOM lifecycle behavior lives only under `src/content/video-lifecycle/`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
yarn test:run src/content
yarn type-check
yarn lint
```

Expected: content tests and static checks pass.

```bash
git add src/content
git commit -m "refactor(content): drive video state from lifecycle monitor"
```

### Task 6: Background Delegation and Full Release Gate

**Files:**
- Modify: `src/background/tab-lifecycle.ts`
- Modify: `src/background/tab-lifecycle.test.ts`
- Modify: `docs/manual-smoke-test.md`

**Interfaces:**
- Consumes: content-side automatic lifecycle reporting.
- Produces: initial connection setup without treating completed-tab detection as the only source of truth.

- [ ] **Step 1: Characterize initial background behavior**

Add tests proving `handleTabCompleted` still sends `resetElement` and `detectVideo` for an initial full load, but a failed immediate response leaves the tab in `detecting` rather than terminal `not_detected`; later `contentStatus` remains authoritative.

- [ ] **Step 2: Run test and confirm RED**

Run `yarn test:run src/background/tab-lifecycle.test.ts`.

Expected: FAIL because detection failure currently writes `not_detected`.

- [ ] **Step 3: Make initial detection nonterminal**

On failed immediate detection, write:

```ts
await dependencies.updateTabInfo(tabId, {
  connectionStatus: 'connected',
  videoStatus: 'detecting',
});
```

Do not add polling or repeated background timers.

- [ ] **Step 4: Run the automated release gate**

Run:

```bash
yarn type-check
yarn lint
yarn test:run
yarn build
git diff --check
```

Expected: all commands exit 0; Webpack may emit existing asset-size warnings.

- [ ] **Step 5: Execute Chrome lifecycle smoke tests**

Reload the unpacked extension and record results in `docs/manual-smoke-test.md` for:

- initial load without advertisement;
- initial placeholder followed by content;
- pre-roll advertisement with controls inactive;
- same video element changing from advertisement MP4 to content blob source;
- at least three consecutive Next Episode transitions;
- side panel close/reopen during transition;
- automatic `detecting -> detected` without pressing Detect video.

Record Chrome version, tested URLs, advertisement presence, pass/fail, and console errors. Any intermittent failure blocks completion.

- [ ] **Step 6: Commit the release evidence**

```bash
git add src/background/tab-lifecycle.ts src/background/tab-lifecycle.test.ts docs/manual-smoke-test.md
git commit -m "test(release): verify persistent video lifecycle"
```

## Self-Review

- Spec coverage: classifier, same-element source changes, advertisement exclusion, placeholder handling, SPA route changes, stale video cleanup, delayed detection, cache preservation, manual recovery, background delegation, and Chrome verification each have an owning task.
- Scope: subtitle parsing, playback metadata extraction, advertisement suppression, and permission changes remain excluded.
- Type consistency: `VideoLifecycleState`, `VideoLifecycleEvent`, `VideoLifecycleMonitor`, `classifyCoupangPlayVideo`, and `observeVideoRoute` names are consistent across producer and consumer tasks.
- Placeholder scan: every implementation task contains concrete interfaces, RED/GREEN commands, expected results, and commit boundaries.
