import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Checkbox({ checked, onChange }: CheckboxProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-7 h-7 border rounded flex justify-center items-center ${checked ? 'bg-teal-500' : 'bg-gray-500'}`}
    >
      <span className='text-white'>
        {checked ? <CheckIcon className='size-5' /> : <XMarkIcon className='size-5' />}
      </span>
    </button>
  );
}

export default Checkbox;
