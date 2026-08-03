export const applyStyles = (element: HTMLElement, styles: Partial<CSSStyleDeclaration>) => {
  Object.assign(element.style, styles);
};

export const createElement = (id: string, tagName: string = 'div') => {
  const element = document.createElement(tagName);
  element.id = id;
  return element;
};

export const calculatePadding = (containerWidth: number, containerHeight: number) => {
  const targetRatio = 16 / 9;
  const currentRatio = containerWidth / containerHeight;

  if (currentRatio >= targetRatio) {
    const videoWidth = containerHeight * (16 / 9);
    return {
      paddingX: Math.round((containerWidth - videoWidth) / 2),
      paddingY: 0,
    };
  }

  const videoHeight = containerWidth * (9 / 16);
  return {
    paddingX: 0,
    paddingY: Math.round((containerHeight - videoHeight) / 2),
  };
};
