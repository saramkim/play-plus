import { replaceWithChildAndTransferId } from '../utils/dom';

interface CheckboxProps {
  id: string;
  checked?: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ id, checked = false, onChange }: CheckboxProps) {
  const template = (document.getElementById('checkbox-template') as HTMLTemplateElement).content.cloneNode(
    true
  ) as DocumentFragment;
  const box = template.querySelector('[data-role="checkbox-box"]') as HTMLDivElement;
  const text = box.querySelector('[data-role="checkbox-text"]') as HTMLSpanElement;
  const input = box.querySelector('[data-role="checkbox-input"]') as HTMLInputElement;

  const update = (checked: boolean) => {
    if (checked) box.classList.replace('bg-gray-500', 'bg-teal-500');
    else box.classList.replace('bg-teal-500', 'bg-gray-500');
    text.textContent = checked ? '✔' : '✖';
  };

  if (checked) {
    input.defaultChecked = true;
    update(true);
  }

  box.addEventListener('click', () => input.click());

  input.addEventListener('input', (event) => {
    const { checked } = event.target as HTMLInputElement;
    update(checked);
    onChange(checked);
  });

  return replaceWithChildAndTransferId(id, box, '[data-role="checkbox-input"]');
}
