import { INPUT_ID_TO_STORAGE_OPTION_KEY, InputId } from './constants';
import { VALIDATION_RULE } from './validation';

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

export function setElementVisibility(id: string, isVisible: boolean) {
  const element = document.getElementById(id);

  if (isVisible) element?.classList.remove('hidden');
  else element?.classList.add('hidden');
}

export function setElementAvailability(id: string, isAvailable: boolean) {
  const element = document.getElementById(id) as HTMLInputElement;
  element.disabled = !isAvailable;
}

export function setupInput(elementId: InputId, defaultValue?: string): HTMLInputElement {
  const input = document.getElementById(elementId) as HTMLInputElement;
  const key = INPUT_ID_TO_STORAGE_OPTION_KEY[elementId];

  if (key && VALIDATION_RULE[key]) {
    const rule = VALIDATION_RULE[key];
    input.type = rule.type;
    if (rule.max) input.max = rule.max.toString();
    if (rule.min) input.min = rule.min.toString();
  }

  if (defaultValue) input.value = defaultValue;

  return input;
}
