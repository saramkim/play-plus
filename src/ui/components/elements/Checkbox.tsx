import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`size-8 border border-gray-200 rounded-sm flex justify-center items-center ${
        checked ? 'bg-teal-500' : 'bg-gray-500'
      }`}
    >
      <span className='text-white'>
        {checked ? <CheckIcon className='size-6' /> : <XMarkIcon className='size-6' />}
      </span>
    </button>
  );
}

export default Checkbox;
