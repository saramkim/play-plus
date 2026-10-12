import { t } from '@utils/i18n';
import { create } from 'zustand';

import { useToastStore } from '@/content/core/store/toast-store';
import { useListeningMissionActiveStore } from '@/content/features/listening-session/mission-active-store';
import { useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { getControlledMedia, isMediaIntervalAllowed } from '@/content/features/video/media-controls';
import { usePlaybackContextStore } from '@/content/playback-context/playback-context-store';

type RepetitionMode = 'cue' | 'ab' | 'once' | null;
interface RepetitionState { mode: RepetitionMode; start: number | null; end: number | null }

export const useRepetitionStore = create<RepetitionState>(() => ({ mode: null, start: null, end: null }));

export class PlaybackRepetition {
  private timer: ReturnType<typeof setInterval> | null = null;
  private video: HTMLVideoElement | null = null;
  private identity = '';
  private subtitleRevision = 0;
  private ownSeek: number | null = null;
  private operation = 0;
  commandRevision = 0;
  private unsubscribeMission: (() => void) | null = null;
  private unsubscribeContext: (() => void) | null = null;
  private unsubscribeSubtitles: (() => void) | null = null;

  private endExecution = () => {
    this.operation += 1;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.video?.removeEventListener('seeking', this.onSeeking);
    this.video?.removeEventListener('seeked', this.onSeeked);
    this.ownSeek = null;
    useRepetitionStore.setState({ mode: null });
  };

  private play = () => {
    const operation = ++this.operation;
    void this.video?.play().catch(() => {
      if (operation !== this.operation) return;
      this.endExecution();
      useToastStore.getState().addToast(t('extension_name'), t('v2_playback_failed'));
    });
  };

  stop = () => {
    this.endExecution();
    this.unsubscribeMission?.();
    this.unsubscribeMission = null;
    this.unsubscribeContext?.();
    this.unsubscribeSubtitles?.();
    this.unsubscribeContext = null;
    this.unsubscribeSubtitles = null;
    this.video?.removeEventListener('seeking', this.onSeeking);
    this.video?.removeEventListener('seeked', this.onSeeked);
    this.video = null;
    this.ownSeek = null;
    useRepetitionStore.setState({ mode: null, start: null, end: null });
  };

  start(mode: Exclude<RepetitionMode, null>, start: number, end: number) {
    if (!isMediaIntervalAllowed(start, end)) return false;
    this.commandRevision += 1;
    this.bind();
    const current = useRepetitionStore.getState();
    if (current.mode === mode && mode !== 'once') {
      this.endExecution();
      return true;
    }
    this.endExecution();
    useRepetitionStore.setState({ mode, start, end });
    this.video?.addEventListener('seeking', this.onSeeking);
    this.video?.addEventListener('seeked', this.onSeeked);
    this.timer = setInterval(this.tick, 25);
    this.seek(start);
    this.play();
    return true;
  }

  setPoint(point: 'start' | 'end', value: number) {
    this.invalidateIfStale();
    const current = useRepetitionStore.getState();
    const start = point === 'start' ? value : current.start ?? Math.max(0, value - 10);
    const end = point === 'end' ? value : current.end ?? value + 10;
    if (!isMediaIntervalAllowed(start, end)) return false;
    this.commandRevision += 1;
    this.bind();
    if (current.mode === 'once') this.endExecution();
    useRepetitionStore.setState({ start, end, mode: current.mode === 'once' ? null : current.mode });
    if ((current.mode === 'cue' || current.mode === 'ab') && this.video &&
      (this.video.currentTime < start || this.video.currentTime >= end)) this.seek(start);
    return true;
  }

  navigate(time: number, cue?: { start: number; end: number }) {
    this.commandRevision += 1;
    this.invalidateIfStale();
    const state = useRepetitionStore.getState();
    if (state.mode === 'cue' && cue) {
      useRepetitionStore.setState({ start: cue.start, end: cue.end });
    } else if (state.mode === 'once' || (state.mode !== null &&
      (time < (state.start ?? 0) || time >= (state.end ?? 0)))) {
      this.endExecution();
    }
    // Other callers also use this for ordinary seeks before any repetition is bound.
    const media = getControlledMedia();
    if (media) {
      if (this.video === media.video) this.seek(time);
      else media.video.currentTime = time;
    }
  }

  private bind() {
    const media = getControlledMedia();
    if (!media) return;
    this.invalidateIfStale();
    this.video = media.video;
    this.identity = identityKey(media.status);
    this.subtitleRevision = useSubtitleStore.getState().subtitleRevision;
    if (this.unsubscribeMission === null) {
      this.unsubscribeMission = useListeningMissionActiveStore.subscribe(({ active }) => { if (active) this.stop(); });
      this.unsubscribeContext = usePlaybackContextStore.subscribe(this.invalidateIfStale);
      this.unsubscribeSubtitles = useSubtitleStore.subscribe(this.invalidateIfStale);

    }
  }

  private tick = () => {
    this.invalidateIfStale();
    const media = getControlledMedia();
    if (!media || !this.video) return;
    const { mode, start, end } = useRepetitionStore.getState();
    if (!mode || start === null || end === null) return;
    if (!isMediaIntervalAllowed(start, end)) { this.stop(); return; }
    if ((media.video.paused && !media.video.ended) || media.video.seeking || this.ownSeek !== null) return;
    if (media.video.currentTime < start) { this.endExecution(); return; }
    if (media.video.currentTime >= end) {
      if (mode === 'once') {
        this.endExecution();
        media.video.pause();
        media.video.currentTime = end;
      } else {
        const ended = media.video.ended;
        this.seek(start);
        if (ended) this.play();
      }
    }
  };

  private invalidateIfStale = () => {
    if (!this.video) return;
    const media = getControlledMedia();
    if (!media || media.video !== this.video || identityKey(media.status) !== this.identity ||
      useSubtitleStore.getState().subtitleRevision !== this.subtitleRevision) this.stop();
  };

  private seek(time: number) {
    if (!this.video) return;
    if (this.video.currentTime === time) {
      if (this.video.seeking) this.ownSeek = time;
      return;
    }
    this.ownSeek = time;
    this.video.currentTime = time;
  }

  private onSeeking = () => {
    if (!this.video) return;
    if (this.ownSeek !== null && Math.abs(this.video.currentTime - this.ownSeek) < 0.05) return;
    this.ownSeek = null;
    const { mode, start, end } = useRepetitionStore.getState();
    if (mode === 'once' || (mode !== null && (this.video.currentTime < (start ?? 0) || this.video.currentTime >= (end ?? 0)))) {
      this.endExecution();
    }
  };
  private onSeeked = () => { if (!this.video?.seeking) this.ownSeek = null; };
}

const identityKey = (status: NonNullable<ReturnType<typeof getControlledMedia>>['status']) =>
  JSON.stringify([status.contentInstanceId, status.contentEpoch, status.videoId, status.videoRevision,
    status.mediaAttachmentRevision, status.routeChangedAt, status.subtitleIdentity]);

export const playbackRepetition = new PlaybackRepetition();
