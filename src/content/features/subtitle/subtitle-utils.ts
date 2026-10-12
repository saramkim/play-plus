import { StorageSchema } from '@storage/type';

import { applyStyles } from '@/content/core/utils/dom';

export const arrayToHeadersObject = (headersArray: chrome.webRequest.HttpHeader[]): Record<string, string> => {
  return headersArray.reduce((obj, item) => {
    return { ...obj, [item.name]: item.value };
  }, {});
};

export const createSubtitleElement = () => {
  const subtitle = document.createElement('p');

  applyStyles(subtitle, {
    lineHeight: '1.5em',
    display: 'none',
    left: '50%',
    pointerEvents: 'auto',
    cursor: 'pointer',
    zIndex: '1000',
    padding: '0 0.5em',
    position: 'absolute',
  });

  return subtitle;
};

export const applySubtitleStyles = (subtitle: HTMLElement, config: StorageSchema['primarySubtitle']) => {
  const { enabled, positionReference, positionOffset, color, fontSize, fontWeight, lineBreak, backgroundOpacity } =
    config;

  const positions = {
    top: { top: `calc(1.5em + ${positionOffset}px)`, bottom: 'auto', transform: 'translate(-50%, -50%)' },
    center: { top: `calc(50% + ${positionOffset}px)`, bottom: 'auto', transform: 'translate(-50%, -50%)' },
    bottom: { top: 'auto', bottom: `calc(1.5em + ${positionOffset}px)`, transform: 'translate(-50%, 50%)' },
  };

  applyStyles(subtitle, {
    display: enabled ? 'block' : 'none',
    color,
    fontSize: `${0.5 + 0.1 * fontSize}em`,
    fontWeight: `${200 + 100 * fontWeight}`,
    textShadow: getSubtitleTextShadow(config.shadowStrength),
    whiteSpace: lineBreak ? 'pre-line' : 'nowrap',
    backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity * 0.01})`,
    ...positions[positionReference],
  });
};

export const getSubtitleTextShadow = (strength: number) => {
  if (strength === 0) return 'none';
  if (strength < 2) return `rgba(0, 0, 0, ${strength / 2}) 2px 2px 2px`;

  const original = 'black 2px 2px 2px';
  if (strength === 2) return original;

  const color = `rgba(0, 0, 0, ${(strength - 2) / 8})`;
  const outline = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ].map(([x, y]) => `${color} ${x}px ${y}px 1px`);
  return [original, ...outline].join(', ');
};
