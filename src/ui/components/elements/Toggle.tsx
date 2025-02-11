interface ToggleProps {
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}

function Toggle({ isOn, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => onChange(!isOn)}
      className={`w-[52px] h-[30px] flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors duration-200 ${
        isOn ? 'bg-teal-500' : 'bg-gray-300'
      }`}
    >
      <div
        className={`bg-white size-[22px] rounded-full shadow-md transform transition-transform duration-200 ${
          isOn ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      ></div>
    </div>
  );
}

export default Toggle;
