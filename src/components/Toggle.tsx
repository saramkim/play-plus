interface ToggleProps {
  isOn: boolean;
  onChange: (isOn: boolean) => void;
}

function Toggle({ isOn, onChange }: ToggleProps) {
  return (
    <div
      onClick={() => onChange(!isOn)}
      className={`w-12 h-7 flex items-center bg-gray-300 rounded-full p-1 cursor-pointer transition-colors duration-200 ${
        isOn ? 'bg-teal-500' : 'bg-gray-300'
      }`}
    >
      <div
        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
          isOn ? 'translate-x-5' : 'translate-x-0'
        }`}
      ></div>
    </div>
  );
}

export default Toggle;
