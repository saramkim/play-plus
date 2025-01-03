import { TOAST_CONTAINER_ID } from './constants';
import { getMessage } from './i18n';

export const selectVideoElement = (): Promise<HTMLVideoElement> => {
  return new Promise((resolve, reject) => {
    const existingVideo = document.querySelector('video');
    if (existingVideo) {
      resolve(existingVideo);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const video = addedNodes.find((node) => node instanceof HTMLVideoElement);

          if (video) {
            observer.disconnect();
            resolve(video);
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(getMessage('error_video_not_found')));
    }, 5000);
  });
};

export const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
  Object.assign(element.style, styles);
};

export const createTooltip = (text?: string) => {
  const tooltip = document.createElement('div');

  applyStyles(tooltip, {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    lineHeight: '16px',
    whiteSpace: 'nowrap',
    zIndex: '1000',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s ease',
  });
  tooltip.textContent = text ?? '';

  return tooltip;
};

export const createElement = (id: string, tagName: string = 'div') => {
  const element = document.createElement(tagName);
  element.id = id;
  return element;
};

export function showToast(title: string, message: string, type: 'success' | 'error') {
  const container = document.getElementById(TOAST_CONTAINER_ID);

  if (!container) {
    console.error('Toast container not found');
    return;
  }

  const toast = document.createElement('div');
  const titleElement = document.createElement('span');
  const messageElement = document.createElement('span');

  toast.classList.add('toast', `toast-${type}`);
  titleElement.classList.add('toast-title');
  titleElement.textContent = title;
  messageElement.textContent = message;

  toast.appendChild(titleElement);
  toast.appendChild(messageElement);
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
