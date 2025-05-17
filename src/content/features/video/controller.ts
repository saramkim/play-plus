import { getStorage } from '@storage/index';
import { StorageChanges } from '@storage/type';
import { SETTINGS } from '@utils/constants';

import { KeyBindingManager } from './key-bindings';

const { SHORTCUTS, VIDEO_SKIP, SUB_VIDEO_SKIP, LOOP, PLAYBACK_SPEED } = SETTINGS;

export class VideoController {
  private keyBindingManager = new KeyBindingManager();

  constructor() {
    this.initialize();
  }

  onVideoControlStorageChange(changes: StorageChanges) {
    const shortcutsChange = changes[SHORTCUTS.STORAGE_KEY];
    if (shortcutsChange) {
      this.keyBindingManager.handleShortcutsStorageChange(shortcutsChange);
    }

    const videoSkipChange = changes[VIDEO_SKIP.STORAGE_KEY];
    if (videoSkipChange) {
      this.keyBindingManager.handleVideoSkipStorageChange(videoSkipChange);
    }
    const subVideoSkipChange = changes[SUB_VIDEO_SKIP.STORAGE_KEY];
    if (subVideoSkipChange) {
      this.keyBindingManager.handleVideoSkipStorageChange(subVideoSkipChange);
    }

    const loopChange = changes[LOOP.STORAGE_KEY];
    if (loopChange) {
      this.keyBindingManager.handleLoopStorageChange(loopChange);
    }

    const playbackSpeedChange = changes[PLAYBACK_SPEED.STORAGE_KEY];
    if (playbackSpeedChange) {
      this.keyBindingManager.handlePlaybackSpeedStorageChange(playbackSpeedChange);
    }
  }

  private async initialize() {
    const [shortcuts, videoSkip, subVideoSkip, loop, playbackSpeed] = await Promise.all([
      getStorage(SHORTCUTS.STORAGE_KEY),
      getStorage(VIDEO_SKIP.STORAGE_KEY),
      getStorage(SUB_VIDEO_SKIP.STORAGE_KEY),
      getStorage(LOOP.STORAGE_KEY),
      getStorage(PLAYBACK_SPEED.STORAGE_KEY),
    ]);

    this.keyBindingManager.handleShortcutsStorageChange({ newValue: shortcuts });
    this.keyBindingManager.handleVideoSkipStorageChange({ newValue: videoSkip });
    this.keyBindingManager.handleVideoSkipStorageChange({ newValue: subVideoSkip });
    this.keyBindingManager.handleLoopStorageChange({ newValue: loop });
    this.keyBindingManager.handlePlaybackSpeedStorageChange({ newValue: playbackSpeed });

    document.addEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.isInputField()) return;

    const keyBindings = this.keyBindingManager.getKeyBindings();
    const handler = keyBindings[event.code];
    if (handler) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }
  };

  private isInputField(): boolean {
    const activeElementTag = document.activeElement?.tagName || '';
    return ['INPUT', 'TEXTAREA'].includes(activeElementTag);
  }
}
