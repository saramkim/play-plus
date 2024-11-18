import { setupInput } from '../utils/dom';

interface NumberInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
}

export const NumberInput = ({ id, value, onChange }: NumberInputProps) => {
  const input = setupInput(id, value.toString());

  input.addEventListener('input', (event) => {
    const target = event.target as HTMLInputElement;
    onChange(parseInt(target.value, 10));
  });

  return input;
};
