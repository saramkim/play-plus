import { replaceWithChildAndTransferId } from '../utils/dom';

interface SwitchOption<Value extends string> {
  label: string;
  value: Value;
}

interface SwitchProps<Value extends string> {
  id: string;
  options: SwitchOption<Value>[];
  initialValue?: Value;
  onChange: (value: Value) => void;
}

export function Switch<Value extends string>({ id, options, initialValue, onChange }: SwitchProps<Value>) {
  const template = (document.getElementById('switch-template') as HTMLTemplateElement).content.cloneNode(
    true
  ) as DocumentFragment;
  const box = template.querySelector('[data-role="switch-box"]') as HTMLDivElement;
  const optionsContainer = box.querySelector('[data-role="switch-options"]') as HTMLDivElement;
  const input = box.querySelector('[data-role="switch-input"]') as HTMLInputElement;

  let currentValue = initialValue ?? options[0].value;

  const update = (value: Value) => {
    currentValue = value;
    Array.from(optionsContainer.children).forEach((child, index) => {
      const optionButton = child as HTMLDivElement;
      const isActive = options[index].value === value;

      if (isActive) {
        optionButton.classList.replace('bg-white', 'bg-teal-500');
        optionButton.classList.replace('text-black', 'text-white');
      } else {
        optionButton.classList.replace('bg-teal-500', 'bg-white');
        optionButton.classList.replace('text-white', 'text-black');
      }
    });
  };

  options.forEach(({ label, value }, i) => {
    const button = document.createElement('div');
    button.textContent = label;
    button.className = `flex justify-center items-center w-full h-full cursor-pointer bg-white text-black ${
      i === 0 ? '' : 'border-l'
    }`;
    button.addEventListener('click', () => {
      if (currentValue !== value) {
        update(value);
        onChange(value);
      }
    });
    optionsContainer.appendChild(button);
  });

  input.defaultValue = currentValue;
  update(currentValue);

  input.addEventListener('input', (event) => {
    const value = (event.target as HTMLInputElement).value as Value;
    update(value);
  });

  return replaceWithChildAndTransferId(id, box, '[data-role="switch-input"]') as HTMLInputElement;
}
