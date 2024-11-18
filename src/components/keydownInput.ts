import { setupInput } from '../utils/dom';

interface KeydownInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export const KeydownInput = ({ id, value, onChange }: KeydownInputProps) => {
  const input = setupInput(id, value.toString());

  input.addEventListener('keydown', (event) => {
    event.preventDefault();
    input.value = event.code;
    input.blur();
    onChange(event.code);
  });

  return input;
};
