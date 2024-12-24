import { INPUT_ID_TO_STORAGE_OPTION_KEY } from './constants';
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

export const setElementVisibility = (id: string, isVisible: boolean) => {
  const element = document.getElementById(id);

  if (isVisible) element?.classList.remove('hidden');
  else element?.classList.add('hidden');
};

export const setElementAvailability = (id: string, isAvailable: boolean) => {
  const element = document.getElementById(id) as HTMLInputElement | HTMLButtonElement;
  element.disabled = !isAvailable;
};

export const setupInput = (id: string, defaultValue?: string): HTMLInputElement => {
  const input = document.getElementById(id) as HTMLInputElement;
  const key = INPUT_ID_TO_STORAGE_OPTION_KEY[id];

  if (defaultValue) input.defaultValue = defaultValue;

  return input;
};

export const replaceWithChildAndTransferId = (
  parentId: string,
  child: HTMLElement,
  targetSelector?: string
): HTMLElement | null => {
  const parentElement = document.getElementById(parentId);
  if (!parentElement) {
    console.error(`Element with id "${parentId}" not found.`);
    return null;
  }

  if (targetSelector) {
    const targetElement = child.querySelector(targetSelector) as HTMLElement;
    if (!targetElement) {
      console.error(`Target element "${targetSelector}" not found in child.`);
      return null;
    }
    targetElement.id = parentElement.id;
    parentElement.replaceWith(child);

    return targetElement;
  }

  child.id = parentElement.id;
  parentElement.replaceWith(child);

  return child;
};

export const resetInputValue = (id: string, options?: { triggerEvent?: boolean; eventType?: string }) => {
  const input = document.getElementById(id) as HTMLInputElement;
  const { defaultValue, defaultChecked } = input;
  const { triggerEvent = true, eventType = 'input' } = options || {};

  input.value = defaultValue;
  input.checked = defaultChecked;

  if (triggerEvent) {
    const event =
      eventType === 'keydown' || eventType === 'keyup'
        ? new KeyboardEvent(eventType, { code: defaultValue, bubbles: true })
        : new Event(eventType, { bubbles: true });
    input.dispatchEvent(event);
  }

  return input;
};

export const updateDefaultValue = (instance: HTMLInputElement, value: string | number | boolean) => {
  switch (typeof value) {
    case 'string':
      instance.defaultValue = value;
      break;
    case 'number':
      instance.defaultValue = value.toString();
      break;
    case 'boolean':
      instance.defaultChecked = value;
      break;
  }
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
