import { V2SyncStorage } from '@storage/v2/type';

import { applyStyles } from '@/content/core/utils/dom';
import { SubtitleRole } from '@/content/features/subtitle/subtitle-store';

type SubtitleRoleDisplay = V2SyncStorage['subtitleDisplay'][SubtitleRole];

export const arrayToHeadersObject = (headersArray: chrome.webRequest.HttpHeader[]): Record<string, string> => {
  return headersArray.reduce((obj, item) => {
    return { ...obj, [item.name]: item.value };
  }, {});
};

export const createSubtitleElement = (role: SubtitleRole) => {
  const subtitle = document.createElement('p');
  subtitle.dataset.subtitleRole = role;

  applyStyles(subtitle, {
    lineHeight: '1.5em',
    display: 'none',
    left: '50%',
    pointerEvents: 'none',
    zIndex: '1000',
    padding: '0 0.5em',
    position: 'absolute',
  });

  return subtitle;
};

export const applySubtitleStyles = (subtitle: HTMLElement, display: SubtitleRoleDisplay) => {
  const {
    visibility,
    appearance: { positionReference, positionOffset, color, fontSize, fontWeight, lineBreak, backgroundOpacity },
  } = display;

  const positions = {
    top: { top: `calc(1.5em + ${positionOffset}px)`, bottom: 'auto', transform: 'translate(-50%, -50%)' },
    center: { top: `calc(50% + ${positionOffset}px)`, bottom: 'auto', transform: 'translate(-50%, -50%)' },
    bottom: { top: 'auto', bottom: `calc(1.5em + ${positionOffset}px)`, transform: 'translate(-50%, 50%)' },
  };

  applyStyles(subtitle, {
    display: visibility === 'visible' ? 'block' : 'none',
    color,
    fontSize: `${0.5 + 0.1 * fontSize}em`,
    fontWeight: `${200 + 100 * fontWeight}`,
    whiteSpace: lineBreak ? 'pre-line' : 'nowrap',
    backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity * 0.01})`,
    ...positions[positionReference],
  });
};
