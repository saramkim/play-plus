import { getMessage } from '../utils/i18n';

interface KeydownInputProps {
  value: string;
  onChange: (value: string) => void;
}

const KeydownInput = ({ value, onChange }: KeydownInputProps) => {
  return (
    <div className='relative w-full group'>
      <input
        className='input'
        type='text'
        value={value}
        placeholder={getMessage('press_any_key')}
        onKeyDown={({ code }) => code !== value && onChange(code)}
        readOnly
      />
      {value && (
        <button
          className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hidden group-hover:block group-focus-within:block'
          onClick={() => onChange('')}
        >
          ✖
        </button>
      )}
    </div>
  );
};

export default KeydownInput;
