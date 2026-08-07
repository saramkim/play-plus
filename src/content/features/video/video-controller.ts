import { DEFAULT_V2_SYNC_STORAGE } from '@storage/v2/default';
import { createV2SyncStorage, V2SyncStorageChanges } from '@storage/v2/sync-storage';
import type { V2SyncStorage } from '@storage/v2/type';
import { t } from '@utils/i18n';
import { create } from 'zustand';

import { useToastStore } from '@/content/core/store/toast-store';
import { videoManager } from '@/content/core/video/video-manager';
import { buildLearningCard } from '@/content/features/learning-playback/learning-card-builder';
import { saveLearningCard } from '@/content/features/learning-playback/learning-card-save-coordinator';
import { LearningCueCommand, resolveLearningCueCommand } from '@/content/features/learning-playback/learning-playback';
import { usePlaybackSpeedStore } from '@/content/features/playback-speed/playback-speed-store';
import { selectSubtitleTrack, useSubtitleStore } from '@/content/features/subtitle/subtitle-store';

type VideoControlSettings = Pick<V2SyncStorage, 'learningControls' | 'playbackSpeed' | 'shortcuts'>;
type UserLearningCommand = LearningCueCommand;

interface VideoControlState extends VideoControlSettings {
  ready: boolean;
  setSettings: (settings: VideoControlSettings) => void;
  reset: () => void;
}

const defaultSettings: VideoControlSettings = {
  learningControls: structuredClone(DEFAULT_V2_SYNC_STORAGE.learningControls),
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

  async execute(command: UserLearningCommand) {
    const video = videoManager.get();
    if (!video) {
      showFeedback(t('v2_no_video_available'));
      return;
    }

    const settings = useVideoControlStore.getState();
    if (!isCommandEnabled(command, settings.learningControls)) return;
    const subtitleState = useSubtitleStore.getState();
    const learning = selectSubtitleTrack(subtitleState, 'learning');

    if (command === 'save') {
      const support = selectSubtitleTrack(subtitleState, 'support');
      const result = await saveLearningCard(() => {
        const buildResult = buildLearningCard({
          learningCues: learning.cues,
          learningDelaySeconds: learning.delay,
          supportCues: support.cues,
          supportDelaySeconds: support.delay,
          currentTime: video.currentTime,
          learningLanguage: subtitleState.learningProfile.learningLanguage,
          supportLanguage: subtitleState.learningProfile.supportLanguage,
          url: window.location.href,
        });
        return buildResult.status === 'created' ? buildResult.card : undefined;
      });
      if (result.status === 'card-unavailable') {
        showFeedback(t('v2_no_current_learning_cue_to_save'));
        return;
      }
      if (result.status === 'error') {
        showFeedback(t('v2_learning_card_save_error'));
        return;
      }
      if (result.status === 'busy') return;
      showFeedback(
        'support' in result.card.content
          ? t('v2_learning_card_saved')
          : t('v2_learning_card_saved_without_support')
      );
      return;
    }

    const result = resolveLearningCueCommand({
      command,
      cues: learning.cues,
      currentTime: video.currentTime,
      delaySeconds: learning.delay,
    });
    if (result.status !== 'resolved') {
      showFeedback(
        result.status === 'no-current-cue'
          ? t('v2_no_current_learning_cue')
          : t('v2_no_learning_cue_in_direction')
      );
      return;
    }
    video.currentTime = result.cue.startMs / 1000;
  }

  async toggleSupportSubtitleVisibility(): Promise<boolean> {
    const state = useSubtitleStore.getState();
    if (state.learningProfile.supportLanguage === null) return false;
    const visibility: V2SyncStorage['subtitleDisplay']['support']['visibility'] =
      state.subtitleDisplay.support.visibility === 'visible' ? 'hidden' : 'visible';
    const subtitleDisplay = {
      ...state.subtitleDisplay,
      support: { ...state.subtitleDisplay.support, visibility },
    };

    try {
      await this.dependencies.storage.set('subtitleDisplay', subtitleDisplay);
      state.setSettings({ learningProfile: state.learningProfile, subtitleDisplay });
      return true;
    } catch {
      showFeedback(t('v2_support_subtitle_toggle_error'));
      return false;
    }
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
          learningControls: changes.learningControls?.newValue ?? current.learningControls,
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
    if (!settings.playbackSpeed.enabled) usePlaybackSpeedStore.getState().resetSpeed();
  }

  private handleKeyDown = (event: KeyboardEvent) => {
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
  if (settings.shortcuts.enabled) {
    bind(settings.shortcuts.saveCard, () => execute('save'));
    if (settings.learningControls.previousCue.enabled) bind(settings.shortcuts.previousCue, () => execute('previous'));
    if (settings.learningControls.nextCue.enabled) bind(settings.shortcuts.nextCue, () => execute('next'));
    if (settings.learningControls.repeatCurrentCue.enabled) {
      bind(settings.shortcuts.repeatCurrentCue, () => execute('repeat-current'));
    }
  }
  if (settings.playbackSpeed.enabled) {
    bind(settings.playbackSpeed.increase, () => usePlaybackSpeedStore.getState().increaseSpeed());
    bind(settings.playbackSpeed.decrease, () => usePlaybackSpeedStore.getState().decreaseSpeed());
    bind(settings.playbackSpeed.reset, () => usePlaybackSpeedStore.getState().resetSpeed());
  }
  return bindings;
};

const isCommandEnabled = (
  command: UserLearningCommand,
  controls: V2SyncStorage['learningControls']
) => {
  if (command === 'previous') return controls.previousCue.enabled;
  if (command === 'next') return controls.nextCue.enabled;
  if (command === 'repeat-current') return controls.repeatCurrentCue.enabled;
  return true;
};

const hasRemovedControlValue = (changes: V2SyncStorageChanges) =>
  (changes.learningControls !== undefined && changes.learningControls.newValue === undefined) ||
  (changes.shortcuts !== undefined && changes.shortcuts.newValue === undefined) ||
  (changes.playbackSpeed !== undefined && changes.playbackSpeed.newValue === undefined);

const showFeedback = (message: string) =>
  useToastStore.getState().addToast(t('app_name'), message);
