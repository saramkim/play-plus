import { CONTROL_COMMANDS, ControlCommand } from '@storage/v2/control-settings';
import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { v2SyncStorageSchema } from '@storage/v2/schema';
import { createV2SyncStorage, V2SyncStorageChanges } from '@storage/v2/sync-storage';
import type { V2SyncStorage } from '@storage/v2/type';
import { stripTags } from '@utils/helper';
import { t } from '@utils/i18n';
import { create } from 'zustand';

import { useToastStore } from '@/content/core/store/toast-store';
import { buildLearningCard, buildRoleLearningCard } from '@/content/features/learning-playback/learning-card-builder';
import { saveLearningCard } from '@/content/features/learning-playback/learning-card-save-coordinator';
import { resolveLearningCueCommand } from '@/content/features/learning-playback/learning-playback';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { selectSubtitleTrack, useSubtitleStore } from '@/content/features/subtitle/subtitle-store';
import { getControlledMedia } from '@/content/features/video/media-controls';
import { playbackRepetition, useRepetitionStore } from '@/content/features/video/playback-repetition';
import {
  getCurrentPlaybackFenceEndMs,
  isPlaybackIntervalAllowed,
} from '@/content/playback-context/playback-fence';

type VideoControlSettings = Pick<V2SyncStorage, 'playbackSpeed' | 'shortcuts'>;
type UserLearningCommand = ControlCommand | 'previous' | 'next' | 'repeat-current' | 'save';

interface VideoControlState extends VideoControlSettings {
  ready: boolean;
  setSettings: (settings: VideoControlSettings) => void;
  reset: () => void;
}

const defaultSettings: VideoControlSettings = {
  playbackSpeed: structuredClone(DEFAULT_V2_SYNC_STORAGE.playbackSpeed),
  shortcuts: structuredClone(DEFAULT_V2_SYNC_STORAGE.shortcuts),
};

export const useVideoControlStore = create<VideoControlState>((set) => ({
  ...defaultSettings,
  ready: false,
  setSettings: (settings) => set({ ...settings, ready: true }),
  reset: () => set({ ...structuredClone(defaultSettings), ready: false }),
}));

export type VideoControllerDependencies = {
  document: Document;
  storage: ReturnType<typeof createV2SyncStorage>;
};

const defaultDependencies: VideoControllerDependencies = {
  document,
  storage: createV2SyncStorage(chrome.storage.sync),
};

export class VideoController {
  private visibilityMutation: Promise<unknown> = Promise.resolve();
  private bindings: Record<string, () => void> = {};
  private generation = 0;
  private hasKeydownListener = false;
  private removeStorageListener: (() => void) | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly dependencies = defaultDependencies) {}

  start() {
    if (this.removeStorageListener) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    const generation = ++this.generation;
    const promise = this.initialize(generation).finally(() => {
      if (this.startPromise === promise) this.startPromise = null;
    });
    this.startPromise = promise;
    return promise;
  }

  stop() {
    playbackRepetition.stop();
    this.generation += 1;
    this.startPromise = null;
    this.removeStorageListener?.();
    this.removeStorageListener = null;
    this.bindings = {};
    if (this.hasKeydownListener) {
      this.dependencies.document.removeEventListener('keydown', this.handleKeyDown);
      this.hasKeydownListener = false;
    }
    useVideoControlStore.getState().reset();
  }

  async execute(input: UserLearningCommand) {
    const command = input === 'previous' ? 'previousCue' : input === 'next' ? 'nextCue'
      : input === 'repeat-current' ? 'repeatCurrentCue' : input === 'save' ? 'saveCard' : input;
    const media = getControlledMedia();
    if (!media) return;
    const { video, status, fence } = media;
    const state = useSubtitleStore.getState();
    if (command === 'toggleLearning' || command === 'toggleSupport') {
      await this.toggleSubtitleVisibility(command === 'toggleLearning' ? 'learning' : 'support'); return;
    }
    if (command === 'toggleAB') {
      const current = useRepetitionStore.getState();
      if (!playbackRepetition.start('ab', current.start ?? video.currentTime, current.end ?? video.currentTime + 10)) {
        showFeedback(t('v2_invalid_playback_range'));
      }
      return;
    }
    if (command === 'setA' || command === 'setB') {
      if (!playbackRepetition.setPoint(command === 'setA' ? 'start' : 'end', video.currentTime)) showFeedback(t('v2_invalid_playback_range'));
      return;
    }
    const role = command === 'saveSupport' || command === 'copySupport' ? 'support' : 'learning';
    const track = selectSubtitleTrack(state, role);
    const isNavigation = ['previousCue', 'nextCue', 'secondaryPrevious', 'secondaryNext'].includes(command);
    const profile = useVideoControlStore.getState().shortcuts.navigation[
      command === 'secondaryPrevious' || command === 'secondaryNext' ? 'secondary' : 'primary'];
    const direction = command === 'previousCue' || command === 'secondaryPrevious' ? 'previous' : 'next';
    if (isNavigation && (profile.unit !== 'subtitles' || (track.cues.length === 0 && profile.fallbackEnabled))) {
      const amount = profile.unit === 'subtitles' ? profile.fallbackAmount : profile.amount;
      const unit = profile.unit === 'subtitles' ? profile.fallbackUnit : profile.unit;
      const target = Math.max(0, Math.min(video.duration - 1, video.currentTime +
        (direction === 'previous' ? -1 : 1) * amount * (unit === 'minutes' ? 60 : 1)));
      if (!Number.isFinite(target) || !Number.isFinite(video.duration) || video.duration <= 0 ||
        !isPlaybackIntervalAllowed(target * 1000, target * 1000, fence)) {
        showFeedback(t('v2_invalid_playback_range')); return;
      }
      playbackRepetition.navigate(target); return;
    }
    if (status.subtitleIdentity[role] === null || status.subtitleIdentity.subtitleRevision !== state.subtitleRevision) {
      showFeedback(t('v2_no_current_learning_cue')); return;
    }
    const result = resolveLearningCueCommand({
      command: isNavigation ? direction : 'save', cues: track.cues, currentTime: video.currentTime,
      delaySeconds: track.delay, fenceEndMs: getCurrentPlaybackFenceEndMs(fence), amount: isNavigation ? profile.amount : 1,
    });
    if (result.status !== 'resolved') {
      showFeedback(t(result.status === 'no-current-cue' ? 'v2_no_current_learning_cue' : 'v2_no_learning_cue_in_direction')); return;
    }
    const { cue } = result;
    if (cue.startMs < 0 || cue.endMs > video.duration * 1000 ||
      !isPlaybackIntervalAllowed(cue.startMs, cue.endMs, fence)) { showFeedback(t('v2_invalid_playback_range')); return; }
    if (command === 'copyLearning' || command === 'copySupport') {
      try { await navigator.clipboard.writeText(stripTags(cue.cue.text)); showFeedback(t('v2_library_copied')); }
      catch { showFeedback(t('v2_library_copy_error')); }
      return;
    }
    if (command === 'saveCard' || command === 'saveLearning' || command === 'saveSupport') {
      const support = selectSubtitleTrack(state, 'support');
      const saved = await saveLearningCard(() => {
        const current = getControlledMedia();
        if (!current || current.video !== video || useSubtitleStore.getState().subtitleRevision !== state.subtitleRevision) return undefined;
        const language = role === 'learning' ? state.learningProfile.learningLanguage : state.learningProfile.supportLanguage;
        if (language === null) return undefined;
        const built = command === 'saveCard' ? buildLearningCard({
          learningCues: track.cues, learningDelaySeconds: track.delay,
          supportCues: support.cues, supportDelaySeconds: support.delay,
          currentTime: video.currentTime, learningLanguage: language,
          supportLanguage: state.learningProfile.supportLanguage, url: window.location.href,
        }) : buildRoleLearningCard({ role, cue, language, url: window.location.href });
        return built.status === 'created' ? built.card : undefined;
      });
      if (saved.status === 'busy') return;
      showFeedback(t(saved.status === 'saved' ? 'v2_learning_card_saved' : 'v2_learning_card_save_error'));
      return;
    }
    const interval = { start: cue.startMs / 1000, end: cue.endMs / 1000 };
    if (command === 'repeatCurrentCue' || command === 'playOnce') {
      if (!playbackRepetition.start(command === 'playOnce' ? 'once' : 'cue', interval.start, interval.end)) showFeedback(t('v2_invalid_playback_range'));
    } else playbackRepetition.navigate(interval.start, interval);
  }

  toggleSupportSubtitleVisibility(): Promise<boolean> { return this.toggleSubtitleVisibility('support'); }

  toggleSubtitleVisibility(role: 'learning' | 'support'): Promise<boolean> {
    const mutation = this.visibilityMutation.then(() => this.applyVisibilityToggle(role));
    this.visibilityMutation = mutation.catch(() => undefined);
    return mutation;
  }

  private async applyVisibilityToggle(role: 'learning' | 'support'): Promise<boolean> {
    if (!getControlledMedia()) return false;
    const initial = useSubtitleStore.getState();
    if (role === 'support' && initial.learningProfile.supportLanguage === null) return false;
    const visibility = initial.subtitleDisplay[role].visibility === 'visible' ? 'hidden' : 'visible';
    const patch = (display: V2SyncStorage['subtitleDisplay']): V2SyncStorage['subtitleDisplay'] => ({
      ...display, [role]: { ...display[role], visibility },
    });
    let observed = initial.subtitleDisplay;
    let ownWrite: V2SyncStorage['subtitleDisplay'] | null = null;
    let echoed = false;
    let wake: (() => void) | undefined;
    let invalid = false;
    const equal = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
    const observe = (display: V2SyncStorage['subtitleDisplay']) => {
      if (!equal(display, ownWrite)) observed = display;
    };
    const unsubscribe = useSubtitleStore.subscribe((state, previous) => {
      if (state.subtitleDisplay !== previous.subtitleDisplay) observe(state.subtitleDisplay);
    });
    const subscription = this.dependencies.storage.subscribe((changes) => {
      if (!changes.subtitleDisplay) return;
      const display = changes.subtitleDisplay.newValue;
      if (!display) { invalid = true; wake?.(); return; }
      if (equal(display, ownWrite)) { echoed = true; wake?.(); }
      else observe(display);
    }, () => { invalid = true; wake?.(); });
    try {
      // Keep external changes separately: our full-object storage echo may
      // temporarily replace the store with an older non-owned field value.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        ownWrite = patch(observed);
        echoed = false;
        if (!equal(await this.dependencies.storage.get('subtitleDisplay'), ownWrite)) {
          await this.dependencies.storage.set('subtitleDisplay', ownWrite);
          if (!echoed && !invalid) {
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, 3000);
              wake = () => { clearTimeout(timer); resolve(); };
            });
          }
          if (!echoed || invalid) throw new Error('Subtitle storage change was not confirmed');
        }
        if (invalid) throw new Error('Subtitle storage changed unexpectedly');
        const latest = useSubtitleStore.getState();
        const next = patch(observed);
        if (equal(next, ownWrite)) {
          latest.setSettings({ learningProfile: latest.learningProfile, subtitleDisplay: next });
          return true;
        }
      }
      throw new Error('Subtitle settings changed during visibility update');
    } catch { showFeedback(t('v2_support_subtitle_toggle_error')); return false; }
    finally { wake?.(); unsubscribe(); subscription.remove(); }
  }

  private async initialize(generation: number) {
    const values = await this.dependencies.storage.getAll();
    if (generation !== this.generation) return;
    this.applySettings(values);
    const registration = this.dependencies.storage.subscribe(
      (changes) => {
        if (hasRemovedControlValue(changes)) {
          this.stop();
          return;
        }
        const current = useVideoControlStore.getState();
        this.applySettings({
          playbackSpeed: changes.playbackSpeed?.newValue ?? current.playbackSpeed,
          shortcuts: changes.shortcuts?.newValue ?? current.shortcuts,
        });
      },
      () => this.stop()
    );
    if (generation !== this.generation) {
      registration.remove();
      return;
    }
    this.removeStorageListener = registration.remove;
    this.dependencies.document.addEventListener('keydown', this.handleKeyDown);
    this.hasKeydownListener = true;
  }

  private applySettings(settings: VideoControlSettings) {
    useVideoControlStore.getState().setSettings(settings);
    this.bindings = createBindings(settings, (command) => void this.execute(command));

  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!getControlledMedia()) return;

    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
      return;
    }
    const handler = this.bindings[event.code];
    if (!handler) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handler();
  };
}

export const videoController = new VideoController();

const createBindings = (settings: VideoControlSettings, execute: (command: UserLearningCommand) => void) => {
  const bindings: Record<string, () => void> = {};
  const bind = (shortcut: string, action: () => void) => {
    if (shortcut) bindings[shortcut] = action;
  };
  if (!v2SyncStorageSchema.safeParse({ ...DEFAULT_V2_SYNC_STORAGE, ...settings }).success) return bindings;
  for (const field of CONTROL_COMMANDS) {
    const binding = settings.shortcuts[field];
    if (binding.enabled) bind(binding.key, () => execute(field));
  }
  const speed = usePlaybackSpeedStore.getState();
  for (const [field, action] of [['increase', speed.increaseSpeed], ['decrease', speed.decreaseSpeed], ['reset', speed.resetSpeed]] as const) {
    if (settings.playbackSpeed[field].enabled) bind(settings.playbackSpeed[field].key, action);
  }
  return bindings;
};

const hasRemovedControlValue = (changes: V2SyncStorageChanges) =>
  (changes.shortcuts !== undefined && changes.shortcuts.newValue === undefined) ||
  (changes.playbackSpeed !== undefined && changes.playbackSpeed.newValue === undefined);

const showFeedback = (message: string) =>
  useToastStore.getState().addToast(t('app_name'), message);
