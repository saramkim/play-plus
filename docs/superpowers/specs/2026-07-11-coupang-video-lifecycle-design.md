# Coupang Play Video Lifecycle Monitor Design

## Goal

Replace one-shot video detection with a persistent lifecycle monitor that reliably connects Play Plus to the current Coupang Play content video across initial loading, placeholders, advertisements, and SPA episode transitions.

During advertisements, Play Plus controls and subtitles remain inactive. During an episode transition, Play Plus reports a detecting state and reconnects automatically when the next content video becomes available.

## Observed Coupang Play Lifecycle

The design is based on direct observation in a signed-in Chrome session on 2026-07-11.

### Initial page load with an advertisement

1. For roughly two seconds, `#playerWrapper` and its video may not exist.
2. Coupang Play creates `video[data-cy="main-video"]` with an empty `src`, `readyState === 0`, and no dimensions. This is a placeholder, not usable content.
3. Coupang Play assigns a direct MP4 URL to the same video element and renders `AdOverlay_*` elements containing `AD`.
4. The advertisement becomes playable and reports a short duration.
5. When the advertisement ends, Coupang Play keeps the same video element but changes its source to a `blob:` content URL and removes the advertisement overlay.

Child-list observation alone cannot detect steps 3 or 5 because the video identity does not change.

### SPA Next Episode transition without an advertisement

1. The old episode URL and content video remain present briefly after the Next Episode action.
2. The browser URL changes without a full page load.
3. Coupang Play removes the old wrapper and video.
4. A new wrapper and `video[data-cy="main-video"]` appear later.
5. The new video progresses from an unready placeholder to playable content.

The background listener currently reacts only to `changeInfo.status === "complete"`, so it does not reliably request detection for this SPA transition. The current `VideoManager` also continues holding the disconnected old element.

## State Model

The lifecycle monitor uses these explicit states:

- `waiting`: no player wrapper or video exists.
- `placeholder`: the main video exists but has no usable source or media metadata.
- `advertisement`: Coupang Play's advertisement overlay is active; the video must not be attached to Play Plus.
- `content`: the main video has a usable source, is not advertising, and is eligible for Play Plus.
- `transitioning`: the route video ID changed, the wrapper disappeared, or the previously attached content video disconnected.

`waiting`, `placeholder`, and `advertisement` are nonterminal states. The monitor continues observing indefinitely rather than resolving `null` after a fixed timeout.

## Architecture

### `CoupangPlayVideoClassifier`

A pure classifier accepts the current player DOM and video state and returns `waiting`, `placeholder`, `advertisement`, or `content`.

Classification rules, in priority order:

1. No `#playerWrapper` or no `video[data-cy="main-video"]`: `waiting`.
2. An advertisement overlay is present inside the player: `advertisement`.
3. The main video has neither `currentSrc` nor `src`: `placeholder`.
4. The main video has not produced a usable media source or metadata yet: `placeholder`.
5. Otherwise: `content`.

Advertisement DOM is the primary signal. Direct-source URLs and short duration are diagnostic fallback signals only; they must not independently classify every short video as advertising.

### `VideoLifecycleMonitor`

The monitor owns ongoing observation and exposes:

```ts
type VideoLifecycleState = 'waiting' | 'placeholder' | 'advertisement' | 'content' | 'transitioning';

type VideoLifecycleEvent = {
  state: VideoLifecycleState;
  video: HTMLVideoElement | null;
  videoId: string | null;
};

interface VideoLifecycleMonitor {
  start(onChange: (event: VideoLifecycleEvent) => void): void;
  refresh(): void;
  stop(): void;
}
```

It observes:

- child additions and removals under the document body;
- `src` attribute changes on video elements;
- `loadedmetadata`, `canplay`, `emptied`, `durationchange`, and `error` media events;
- SPA route video ID changes;
- disconnection of the currently attached video.

Every signal schedules one coalesced classification pass. The monitor emits only when the lifecycle state, video identity, or route video ID changes.

`stop()` disconnects all observers and removes all media and route listeners.

### Route observation

The content script observes the effective URL rather than depending on a completed-tab event. It detects route changes caused by `pushState`, `replaceState`, and `popstate`, then compares `getCoupangPlayVideoId(location.href)` with the last known video ID.

The implementation uses one isolated route observer utility so history instrumentation can be installed and restored safely.

### `VideoManager`

`VideoManager` only holds a classified content video.

When content disappears or changes, it:

1. cancels the previous `requestVideoFrameCallback`;
2. clears the stored video reference;
3. updates `hasVideo` to `false`;
4. allows the message handler to reset content-bound controllers and containers.

When a new content video arrives, it attaches once and starts time tracking. Repeated events for the same connected video are ignored.

### Message handler integration

The content script starts the monitor once during initialization.

- `content` event: attach the new video, initialize Play Plus containers, set detection status to `detected`, and report connected content status.
- `waiting`, `placeholder`, `advertisement`, or `transitioning` after content was attached: detach the old video, reset content-bound UI/controllers, set detection status to `detecting`, and report that content is not currently attached.
- `detectVideo` message: call `refresh()` and respond from the current classified state. It remains a manual recovery mechanism, not the primary lifecycle driver.

Subtitle metadata may arrive before content attachment. It remains cached and becomes displayable when the content video is attached.

### Background responsibilities

The background service worker continues to manage tab status, pending subtitle requests, and queued playback actions. It no longer serves as the sole trigger for SPA video detection.

Completed-tab detection remains useful for initial connection setup, but correctness comes from the content-side monitor.

## Error Handling

- Temporary absence of the wrapper is a normal transition, not a terminal error.
- A placeholder or advertisement can remain indefinitely without stopping observation.
- After 30 seconds without content, the UI reports delayed detection, but the monitor continues running.
- Duplicate mutation and media events are coalesced and deduplicated.
- Invalid or disconnected candidates are never retained by `VideoManager`.
- Monitor callback failures are isolated so they do not disconnect observation.
- `stop()` is idempotent.

## Testing

### Classifier tests

- no wrapper;
- wrapper without video;
- empty-source placeholder;
- advertisement overlay with direct MP4 source;
- same video changing from advertisement MP4 to content blob source;
- valid content video;
- unrelated video outside the player.

### Monitor tests

- placeholder followed by content on the same element;
- placeholder followed by advertisement followed by content on the same element;
- advertisement element replaced by a separate content element;
- old content retained briefly, wrapper removed, then next-episode video created;
- SPA route ID change without a completed-tab event;
- duplicate mutations and media events emit one effective transition;
- delays longer than 30 seconds remain observable;
- all observers and listeners are removed by `stop()`.

### Integration tests

- `VideoManager` releases a disconnected previous video;
- controllers and containers reset during transition and reinitialize for content;
- manual Detect calls `refresh()` and reports the current state;
- subtitle cache survives a video transition;
- content status changes follow `detecting -> detected` automatically.

### Chrome smoke tests

- reload with no advertisement;
- reload with a pre-roll advertisement;
- initial placeholder without immediate source;
- multiple consecutive Next Episode transitions;
- advertisement followed by Next Episode;
- side panel close and reopen during a transition;
- verify Play Plus controls and subtitles are inactive during advertisements and reconnect for content.

## Non-goals

- Modifying or suppressing Coupang Play advertisements.
- Depending on a specific advertisement duration.
- Treating every direct media URL or short video as an advertisement.
- Expanding Chrome extension permissions.
- Redesigning subtitle parsing or playback metadata interception.
