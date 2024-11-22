import { replaceWithChildAndTransferId } from '../utils/dom';

interface ToggleProps {
  id: string;
  isOn?: boolean;
  onChange: (isOn: boolean) => void;
}

export function Toggle({ id, isOn = false, onChange }: ToggleProps) {
  const template = (document.getElementById('toggle-template') as HTMLTemplateElement).content.cloneNode(
    true
  ) as DocumentFragment;
  const toggleButton = template.querySelector('[data-role="toggle-button"]') as HTMLElement;
  const indicator = toggleButton.querySelector('[data-role="indicator"]') as HTMLElement;

  if (isOn) {
    toggleButton.classList.replace('bg-gray-300', 'bg-teal-500');
    indicator.classList.add('translate-x-5');
  }

  toggleButton.addEventListener('click', () => {
    isOn = !isOn;
    onChange(isOn);
    toggleButton.classList.toggle('bg-teal-500');
    toggleButton.classList.toggle('bg-gray-300');
    indicator.classList.toggle('translate-x-5');
  });

  return replaceWithChildAndTransferId(id, toggleButton);
}
