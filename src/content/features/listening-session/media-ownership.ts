export const observeListeningMedia = (
  video: HTMLVideoElement,
  onExternalChange: (field: 'position' | 'rate' | 'paused') => void
) => {
  let expectedPosition = video.currentTime;
  let expectedRate = video.playbackRate;
  let expectedPaused = video.paused;
  const onSeek = () => {
    if (Math.abs(video.currentTime - expectedPosition) > 0.05) onExternalChange('position');
  };
  const onRate = () => {
    if (video.playbackRate !== expectedRate) onExternalChange('rate');
  };
  const onPlayback = () => {
    if (video.paused !== expectedPaused) onExternalChange('paused');
  };
  video.addEventListener('seeking', onSeek);
  video.addEventListener('ratechange', onRate);
  video.addEventListener('play', onPlayback);
  video.addEventListener('pause', onPlayback);
  return {
    get expectedPaused() { return expectedPaused; },
    get expectedRate() { return expectedRate; },
    pause: () => { expectedPaused = true; video.pause(); },
    play: () => { expectedPaused = false; return video.play(); },
    seek: (value: number) => { expectedPosition = value; video.currentTime = value; },
    setRate: (value: number) => { expectedRate = value; video.playbackRate = value; },
    dispose: () => {
      video.removeEventListener('seeking', onSeek);
      video.removeEventListener('ratechange', onRate);
      video.removeEventListener('play', onPlayback);
      video.removeEventListener('pause', onPlayback);
    },
  };
};
