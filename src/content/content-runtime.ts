import { sendMessage } from '@utils/message';
import type { ContentBootstrap } from '@utils/message/type';

import { renderApp } from './app';
import { elementStore } from './core/store/element-store';
import { videoManager } from './core/video/video-manager';
import { playbackSpeedController } from './features/playback-speed/playback-speed';
import { initializeSubtitleSync } from './features/subtitle/subtitle';
import { videoController } from './features/video/video-controller';
import { initializeMessageListener, initializeSubtitleSelections } from './message-handler';

type Disposer = () => void;

export type ContentRuntimeDependencies = {
  clearVideo: Disposer;
  initializeMessageListener: () => Disposer;
  initializeSubtitleSelections: (bootstrap: ContentBootstrap) => Promise<void>;
  initializeSubtitleSync: () => Promise<Disposer>;
  removeContainers: Disposer;
  reportContentInitialized: () => Promise<ContentBootstrap>;
  renderApp: () => Disposer;
  setupSystemContainer: () => void;
  startPlaybackSpeedController: () => void;
  startVideoController: () => Promise<void>;
  stopPlaybackSpeedController: Disposer;
  stopVideoController: Disposer;
};

type RuntimeRun = { cancelled: boolean; disposers: Disposer[]; promise: Promise<void> };

const defaultDependencies: ContentRuntimeDependencies = {
  clearVideo: () => videoManager.clear(),
  initializeMessageListener,
  initializeSubtitleSelections,
  initializeSubtitleSync,
  removeContainers: () => elementStore.removeContainers(),
  reportContentInitialized: async () => {
    const response = await sendMessage('contentInitialized');
    if (!response.success) throw new Error('Content readiness failed');
    return response.data;
  },
  renderApp: () => renderApp(elementStore.getSystemRoot(), elementStore.getVideoRoot()),
  setupSystemContainer: () => elementStore.setupSystemContainer(),
  startPlaybackSpeedController: () => playbackSpeedController.start(),
  startVideoController: () => videoController.start(),
  stopPlaybackSpeedController: () => playbackSpeedController.stop(),
  stopVideoController: () => videoController.stop(),
};

export class ContentRuntime {
  private activeRun: RuntimeRun | null = null;

  constructor(private readonly dependencies = defaultDependencies) {}

  start() {
    if (this.activeRun) return this.activeRun.promise;
    const run: RuntimeRun = { cancelled: false, disposers: [], promise: Promise.resolve() };
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

    const bootstrap = await this.dependencies.reportContentInitialized();
    if (run.cancelled) return;

    const subtitleDisposer = await this.dependencies.initializeSubtitleSync();
    this.addDisposer(run, subtitleDisposer);
    if (run.cancelled) return;
    await this.dependencies.initializeSubtitleSelections(bootstrap);
    if (run.cancelled) return;

    this.addDisposer(run, this.dependencies.initializeMessageListener());
    this.addDisposer(run, this.dependencies.stopPlaybackSpeedController);
    this.dependencies.startPlaybackSpeedController();
    this.addDisposer(run, this.dependencies.stopVideoController);
    await this.dependencies.startVideoController();
    if (run.cancelled) return;

    this.dependencies.setupSystemContainer();
    this.addDisposer(run, this.dependencies.renderApp());
  }

  private addDisposer(run: RuntimeRun, disposer: Disposer) {
    if (run.cancelled) this.dispose(disposer);
    else run.disposers.push(disposer);
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
    } catch {
      console.error('Content runtime cleanup failed');
    }
  }
}

export const contentRuntime = new ContentRuntime();
