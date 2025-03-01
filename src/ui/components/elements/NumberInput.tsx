import { Input } from './input';

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

const NumberInput = ({ value, onChange, ...props }: NumberInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return <Input type='number' value={value.toString()} onChange={handleChange} {...props} />;
};

export default NumberInput;
