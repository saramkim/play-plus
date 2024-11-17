import { Tooltip } from '../components/tooltip';
import { INPUT_ID_TO_STORAGE_OPTION_KEY, InputId } from './constants';
import { VALIDATION_RULE, ValidationResult } from './validation';

export const selectVideoElement = (): Promise<HTMLVideoElement | null> => {
  return new Promise((resolve) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const video = document.querySelector('video');
        resolve(video);
      });
    } else {
      const video = document.querySelector('video');
      resolve(video);
    }
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

export const setButtonAvailabilityWithTag = (id: string, { valid, error }: ValidationResult) => {
  const button = document.getElementById(id) as HTMLButtonElement;
  const tooltip = document.getElementById(id + '_tooltip');

  if (valid) {
    button.disabled = false;
    tooltip?.remove();
  } else {
    button.disabled = true;
    if (tooltip) tooltip.textContent = error;
    else Tooltip({ id: id + '_tooltip', message: error, target: button });
  }
};

export const setupInput = (id: InputId, defaultValue?: string): HTMLInputElement => {
  const input = document.getElementById(id) as HTMLInputElement;
  const key = INPUT_ID_TO_STORAGE_OPTION_KEY[id];

  if (key && VALIDATION_RULE[key]) {
    const rule = VALIDATION_RULE[key];
    input.type = rule.type;
    if (rule.max) input.max = rule.max.toString();
    if (rule.min) input.min = rule.min.toString();
  }

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
  } else {
    child.id = parentElement.id;
  }

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
