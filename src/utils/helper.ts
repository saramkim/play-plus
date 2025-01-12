export const formatTime = (seconds: number): string => {
  const roundedSeconds = Math.round(seconds);
  let hours = Math.floor(roundedSeconds / 3600);
  let minutes = Math.floor((roundedSeconds % 3600) / 60);
  let remainingSeconds = roundedSeconds % 60;

  if (remainingSeconds === 60) {
    remainingSeconds = 0;
    minutes += 1;

    if (minutes === 60) {
      minutes = 0;
      hours += 1;
    }
  }

  const parts = [
    hours > 0 ? String(hours).padStart(2, '0') : null,
    String(minutes).padStart(2, '0'),
    String(remainingSeconds).padStart(2, '0'),
  ].filter(Boolean);

  return parts.join(':');
};
