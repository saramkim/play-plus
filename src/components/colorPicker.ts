import { DEFAULT_SUBTITLE_CONFIG } from '../utils/default';
import { replaceWithChildAndTransferId } from '../utils/dom';

const COLOR_PICKER_SELECTOR = '[data-role="color-picker"]';
interface ColorPickerProps {
  id: string;
  color?: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ id, color = DEFAULT_SUBTITLE_CONFIG.color, onChange }: ColorPickerProps) {
  const colorPickerTemplate = (
    document.getElementById('color-picker-template') as HTMLTemplateElement
  ).content.cloneNode(true) as DocumentFragment;

  const button = colorPickerTemplate.querySelector('[data-role="button"]') as HTMLButtonElement;
  const colorPicker = button.querySelector(COLOR_PICKER_SELECTOR) as HTMLInputElement;

  button.style.backgroundColor = color;
  colorPicker.defaultValue = color;

  button.addEventListener('click', () => {
    colorPicker.click();
  });

  colorPicker.addEventListener('input', (event: Event) => {
    const selectedColor = (event.target as HTMLInputElement).value;
    button.style.backgroundColor = selectedColor;
    onChange(selectedColor);
  });

  return replaceWithChildAndTransferId(id, button, COLOR_PICKER_SELECTOR);
}
