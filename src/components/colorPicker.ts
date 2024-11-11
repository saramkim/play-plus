import { DEFAULT_SUBTITLE_CONFIG } from '../utils/default';

interface ColorPickerProps {
  id?: string;
  color?: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ id, color = DEFAULT_SUBTITLE_CONFIG.color, onChange }: ColorPickerProps) {
  const colorPickerTemplate = (
    document.getElementById('color-picker-template') as HTMLTemplateElement
  ).content.cloneNode(true) as DocumentFragment;
  const button = colorPickerTemplate.querySelector('[data-role="button"]') as HTMLButtonElement;
  const colorPicker = button.querySelector('[data-role="color-picker"]') as HTMLInputElement;

  if (id) colorPicker.id = id;
  button.style.backgroundColor = color;
  colorPicker.value = color;

  button.addEventListener('click', () => {
    colorPicker.click();
  });

  colorPicker.addEventListener('input', (event: Event) => {
    const selectedColor = (event.target as HTMLInputElement).value;
    if (button) button.style.backgroundColor = selectedColor;
    onChange(selectedColor);
  });

  return button;
}
