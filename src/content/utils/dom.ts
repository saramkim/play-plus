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
