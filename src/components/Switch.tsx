type SwitchOption<V extends string> = {
  label: string;
  value: V;
};

interface SwitchProps<V extends string> {
  options: SwitchOption<V>[];
  value: V;
  onChange: (value: V) => void;
}

function Switch<V extends string>({ options, value, onChange }: SwitchProps<V>) {
  return (
    <div className='w-full h-7 select-none border rounded overflow-hidden font-medium'>
      <div className='flex items-center w-full h-full'>
        {options.map((option, i) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`flex justify-center items-center w-full h-full ${
              value === option.value ? 'bg-teal-500 text-white' : 'bg-white text-black'
            } ${i === 0 ? '' : 'border-l'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Switch;
