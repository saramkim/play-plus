interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number;
  onChange: (value: number) => void;
}

const NumberInput = ({ value, onChange, className = '', ...props }: NumberInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseFloat(e.target.value));
  };

  return (
    <input className={`input ${className}`} type='number' value={value.toString()} onChange={handleChange} {...props} />
  );
};

export default NumberInput;
