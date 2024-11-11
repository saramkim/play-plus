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

export function setupInput(elementId: string, defaultValue: string): HTMLInputElement {
  const input = document.getElementById(elementId) as HTMLInputElement;
  input.value = defaultValue;
  return input;
}
