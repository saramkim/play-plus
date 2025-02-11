interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const NumberInput = ({ value, onChange, min, max }: NumberInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  return <input className='input' type='number' value={value.toString()} onChange={handleChange} min={min} max={max} />;
};

export default NumberInput;
