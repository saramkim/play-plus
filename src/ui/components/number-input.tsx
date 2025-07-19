import { Input } from './input';

interface NumberInputProps extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, min } = e.target;
    if (value === '') {
      onChange(min !== '' ? parseFloat(min) : 0);
    } else {
      onChange(parseFloat(value));
    }
  };

  return <Input type='number' value={value.toString()} onChange={handleChange} {...props} />;
}
