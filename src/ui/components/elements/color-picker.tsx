interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className='relative inline-block size-8'>
      <input
        type='color'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
      />
      <div className='w-full h-full rounded-full border' style={{ backgroundColor: value }} />
    </div>
  );
}
