import { onStorageChange } from '@storage/index';
import { sendMessage } from '@utils/message';

import { renderApp } from './app';
import { elementStore } from './core/store/element-store';
import { videoManager } from './core/video/video-manager';
import { loopController } from './features/loop';
import { playbackSpeedController } from './features/playback-speed/playback-speed';
import { initializeSubtitleSync, onSubtitleStorageChange } from './features/subtitle/subtitle';
import { videoController } from './features/video/video-controller';
import { initializeMessageListener } from './message-handler';

type Disposer = () => void;

export type ContentRuntimeDependencies = {
  clearVideo: Disposer;
  initializeMessageListener: () => Disposer;
  initializeStorageChange: () => Disposer;
  initializeSubtitleSync: () => Promise<Disposer>;
  removeContainers: Disposer;
  reportContentInitialized: () => Promise<void>;
  renderApp: () => Disposer;
  setupSystemContainer: () => void;
  startLoopController: () => void;
  startPlaybackSpeedController: () => void;
  startVideoController: () => Promise<void>;
  stopLoopController: Disposer;
  stopPlaybackSpeedController: Disposer;
  stopVideoController: Disposer;
};

type RuntimeRun = {
  cancelled: boolean;
  disposers: Disposer[];
  promise: Promise<void>;
};

const initializeStorageChange = () => {
  const registration = onStorageChange((changes) => {
    onSubtitleStorageChange(changes);
    videoController.onVideoControlStorageChange(changes);
    loopController.onLoopStorageChange(changes);
    playbackSpeedController.onStorageChange(changes);
  });
  return () => registration.remove();
};

const defaultDependencies: ContentRuntimeDependencies = {
  clearVideo: () => videoManager.clear(),
  initializeMessageListener,
  initializeStorageChange,
  initializeSubtitleSync,
  removeContainers: () => elementStore.removeContainers(),
  reportContentInitialized: async () => {
    const response = await sendMessage('contentInitialized');
    if (!response.success) throw new Error(response.message);
  },
  renderApp: () => renderApp(elementStore.getSystemRoot(), elementStore.getVideoRoot()),
  setupSystemContainer: () => elementStore.setupSystemContainer(),
  startLoopController: () => loopController.start(),
  startPlaybackSpeedController: () => playbackSpeedController.start(),
  startVideoController: () => videoController.start(),
  stopLoopController: () => loopController.stop(),
  stopPlaybackSpeedController: () => playbackSpeedController.stop(),
  stopVideoController: () => videoController.stop(),
};

export class ContentRuntime {
  private activeRun: RuntimeRun | null = null;

  constructor(private readonly dependencies = defaultDependencies) {}

  start() {
    if (this.activeRun) return this.activeRun.promise;

    const run: RuntimeRun = {
      cancelled: false,
      disposers: [],
      promise: Promise.resolve(),
    };
    run.promise = this.startRun(run).catch((error: unknown) => {
      const wasCancelled = run.cancelled;
      run.cancelled = true;
      this.releaseRun(run);
      if (this.activeRun === run) this.activeRun = null;
      if (!wasCancelled) throw error;
    });
    this.activeRun = run;
    return run.promise;
  }

  stop() {
    const run = this.activeRun;
    if (!run) return;

    this.activeRun = null;
    run.cancelled = true;
    this.releaseRun(run);
  }

  private async startRun(run: RuntimeRun) {
    this.addDisposer(run, this.dependencies.removeContainers);
    this.addDisposer(run, this.dependencies.clearVideo);

    this.addDisposer(run, this.dependencies.initializeMessageListener());
    this.addDisposer(run, this.dependencies.initializeStorageChange());

    await this.dependencies.reportContentInitialized();
    if (run.cancelled) return;

    this.dependencies.startLoopController();
    this.addDisposer(run, this.dependencies.stopLoopController);

    this.dependencies.startPlaybackSpeedController();
    this.addDisposer(run, this.dependencies.stopPlaybackSpeedController);

    const videoStart = this.dependencies.startVideoController();
    this.addDisposer(run, this.dependencies.stopVideoController);

    const subtitleStart = this.dependencies
      .initializeSubtitleSync()
      .then((disposer) => this.addDisposer(run, disposer));
    await Promise.all([videoStart, subtitleStart]);
    if (run.cancelled) return;

    this.dependencies.setupSystemContainer();
    this.addDisposer(run, this.dependencies.renderApp());
  }

  private addDisposer(run: RuntimeRun, disposer: Disposer) {
    if (run.cancelled) {
      this.dispose(disposer);
      return;
    }
    run.disposers.push(disposer);
  }

  private releaseRun(run: RuntimeRun) {
    let disposer = run.disposers.pop();
    while (disposer) {
      this.dispose(disposer);
      disposer = run.disposers.pop();
    }
  }

  private dispose(disposer: Disposer) {
    try {
      disposer();
    } catch (error) {
      console.error('Content runtime cleanup failed:', error);
    }
  }
}

export const contentRuntime = new ContentRuntime();
