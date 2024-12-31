import { getMessage } from '../utils/i18n';

interface KeydownInputProps {
  value: string;
  onChange: (value: string) => void;
}

const KeydownInput = ({ value, onChange }: KeydownInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    onChange(e.code);
  };

  return (
    <input
      className='input'
      type='text'
      value={value}
      placeholder={getMessage('press_any_key')}
      onKeyDown={handleKeyDown}
      readOnly
    />
  );
};

export default KeydownInput;
