import { beforeEach, describe, expect, it } from 'vitest';

import { classifyCoupangPlayVideo } from './classifier';

const addPlayer = () => {
  const player = document.createElement('div');
  player.id = 'playerWrapper';
  document.body.append(player);
  return player;
};

const addMainVideo = (player: Element) => {
  const video = document.createElement('video');
  video.dataset.cy = 'main-video';
  player.append(video);
  return video;
};

describe('classifyCoupangPlayVideo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('waits when the player or main video is absent', () => {
    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'waiting', video: null });
    addPlayer();
    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'waiting', video: null });
  });

  it('classifies an empty main video as a placeholder', () => {
    const video = addMainVideo(addPlayer());
    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'placeholder', video });
  });

  it('classifies the player as advertising when an ad overlay is present', () => {
    const player = addPlayer();
    const video = addMainVideo(player);
    video.src = 'https://ads.example.com/ad.mp4';
    const overlay = document.createElement('div');
    overlay.className = 'AdOverlay_adOverlay__hash';
    player.append(overlay);

    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'advertisement', video });
  });

  it('classifies a sourced main video without an ad overlay as content', () => {
    const video = addMainVideo(addPlayer());
    video.src = 'blob:https://www.coupangplay.com/content';
    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'content', video });
  });

  it('does not treat a short duration as advertising by itself', () => {
    const video = addMainVideo(addPlayer());
    video.src = 'https://cdn.example.com/short-content.mp4';
    Object.defineProperty(video, 'duration', { configurable: true, value: 15 });
    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'content', video });
  });

  it('ignores videos outside the player', () => {
    const video = document.createElement('video');
    video.dataset.cy = 'main-video';
    video.src = 'blob:https://www.coupangplay.com/unrelated';
    document.body.append(video);
    expect(classifyCoupangPlayVideo(document)).toEqual({ state: 'waiting', video: null });
  });
});
