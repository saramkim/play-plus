import { getStorage } from '@storage/index';
import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { KeyBindingManager } from '@/content/features/navigation/key-bindings';

const { SHORTCUTS, VIDEO_SKIP, SUB_VIDEO_SKIP, LOOP, PLAYBACK_SPEED } = SETTINGS;

export type VideoControllerDependencies = {
  createKeyBindingManager: () => KeyBindingManager;
  document: Document;
  getStorage: typeof getStorage;
};

const defaultDependencies: VideoControllerDependencies = {
  createKeyBindingManager: () => new KeyBindingManager(),
  document,
  getStorage,
};

export class VideoController {
  private generation = 0;
  private keyBindingManager: KeyBindingManager | null = null;
  private pendingChanges: StorageChanges | null = null;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly dependencies = defaultDependencies) {}

  start() {
    if (this.keyBindingManager) return Promise.resolve();
    if (this.startPromise) return this.startPromise;

    const generation = ++this.generation;
    const startPromise = this.initialize(generation)
      .catch((error: unknown) => {
        if (generation === this.generation) this.stop();
        throw error;
      })
      .finally(() => {
        if (this.startPromise === startPromise) this.startPromise = null;
      });
    this.startPromise = startPromise;
    return startPromise;
  }

  stop() {
    this.generation += 1;
    this.startPromise = null;
    this.pendingChanges = null;
    if (this.keyBindingManager) {
      this.dependencies.document.removeEventListener('keydown', this.handleKeyDown);
    }
    this.keyBindingManager = null;
  }

  onVideoControlStorageChange(changes: StorageChanges) {
    if (!this.keyBindingManager) {
      this.pendingChanges = { ...this.pendingChanges, ...changes };
      return;
    }

    this.applyStorageChanges(this.keyBindingManager, changes);
  }

  private applyStorageChanges(keyBindingManager: KeyBindingManager, changes: StorageChanges) {
    const shortcutsChange = changes[SHORTCUTS.STORAGE_KEY];
    if (shortcutsChange) {
      keyBindingManager.handleShortcutsStorageChange(shortcutsChange);
    }

    const videoSkipChange = changes[VIDEO_SKIP.STORAGE_KEY];
    if (videoSkipChange) {
      keyBindingManager.handleVideoSkipStorageChange(videoSkipChange);
    }
    const subVideoSkipChange = changes[SUB_VIDEO_SKIP.STORAGE_KEY];
    if (subVideoSkipChange) {
      keyBindingManager.handleVideoSkipStorageChange(subVideoSkipChange);
    }

    const loopChange = changes[LOOP.STORAGE_KEY];
    if (loopChange) {
      keyBindingManager.handleLoopStorageChange(loopChange);
    }

    const playbackSpeedChange = changes[PLAYBACK_SPEED.STORAGE_KEY];
    if (playbackSpeedChange) {
      keyBindingManager.handlePlaybackSpeedStorageChange(playbackSpeedChange);
    }
  }

  private async initialize(generation: number) {
    const [shortcuts, videoSkip, subVideoSkip, loop, playbackSpeed] = await Promise.all([
      this.dependencies.getStorage(SHORTCUTS.STORAGE_KEY),
      this.dependencies.getStorage(VIDEO_SKIP.STORAGE_KEY),
      this.dependencies.getStorage(SUB_VIDEO_SKIP.STORAGE_KEY),
      this.dependencies.getStorage(LOOP.STORAGE_KEY),
      this.dependencies.getStorage(PLAYBACK_SPEED.STORAGE_KEY),
    ]);
    if (generation !== this.generation) return;

    const keyBindingManager = this.dependencies.createKeyBindingManager();
    keyBindingManager.handleShortcutsStorageChange({ newValue: shortcuts });
    keyBindingManager.handleVideoSkipStorageChange({ newValue: videoSkip });
    keyBindingManager.handleVideoSkipStorageChange({ newValue: subVideoSkip });
    keyBindingManager.handleLoopStorageChange({ newValue: loop });
    keyBindingManager.handlePlaybackSpeedStorageChange({ newValue: playbackSpeed });
    if (generation !== this.generation) return;

    this.keyBindingManager = keyBindingManager;
    if (this.pendingChanges) {
      this.applyStorageChanges(keyBindingManager, this.pendingChanges);
      this.pendingChanges = null;
    }
    this.dependencies.document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.isInputField()) return;

    const keyBindings = this.keyBindingManager?.getKeyBindings() ?? {};
    const handler = keyBindings[event.code];
    if (handler) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }
  };

  private isInputField(): boolean {
    const activeElementTag = this.dependencies.document.activeElement?.tagName || '';
    return ['INPUT', 'TEXTAREA'].includes(activeElementTag);
  }
}

export const videoController = new VideoController();
