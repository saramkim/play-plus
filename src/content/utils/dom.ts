import { getToastContainer } from '@/content/store/element-store';

export const detectVideoElement = (): Promise<HTMLVideoElement> => {
  return new Promise((resolve) => {
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

export function showToast(title: string, message: string, type: 'success' | 'error' | 'info') {
  const container = getToastContainer();
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

export const createMarker = (id: string, text: string) => {
  const container = createElement(id);
  container.classList.add('loop-marker');

  const textElement = document.createElement('span');
  textElement.textContent = text;
  textElement.classList.add('loop-marker-text');
  container.appendChild(textElement);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '30');
  svg.setAttribute('viewBox', '0 0 15 30');

  const rect = document.createElementNS(svgNS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', '15');
  rect.setAttribute('height', '15');
  rect.setAttribute('fill', 'currentColor');

  const triangle = document.createElementNS(svgNS, 'polygon');
  triangle.setAttribute('points', '0,15 15,15 7.5,30');
  triangle.setAttribute('fill', 'currentColor');

  svg.appendChild(rect);
  svg.appendChild(triangle);

  container.appendChild(svg);

  return container;
};

export const createLoopIcon = () => {
  const svgNS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke', 'currentColor');

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute(
    'd',
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99'
  );

  svg.appendChild(path);

  return svg;
};
