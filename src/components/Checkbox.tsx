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
      <span className='text-white font-bold'>{checked ? '✔' : '✖'}</span>
    </button>
  );
}

export default Checkbox;
