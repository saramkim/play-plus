import Dropdown from './Dropdown';

export interface DropdownOption<V> {
  value: V;
  label: string;
}

interface DropdownMenuProps<V extends string> {
  options: DropdownOption<V>[];
  value?: V;
  onClick: (value: V) => void;
  visibleItemCount?: number;
  trigger: (props: { isOpen: boolean; toggleDropdown: () => void }) => React.ReactNode;
}

const ITEM_HEIGHT = 32;

const DropdownMenu = <V extends string>({
  options,
  value,
  onClick,
  visibleItemCount,
  trigger,
}: DropdownMenuProps<V>) => {
  return (
    <Dropdown trigger={trigger}>
      {(close) => (
        <div style={{ maxHeight: visibleItemCount ? visibleItemCount * ITEM_HEIGHT : 'auto' }}>
          {options.map((option) => (
            <button
              key={option.value}
              style={{ height: ITEM_HEIGHT }}
              className={`flex items-center px-2 w-full focus:outline-none ${
                option.value === value ? 'bg-gray-200' : 'hover:bg-gray-100'
              }`}
              onClick={() => {
                onClick(option.value);
                close();
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
};

export default DropdownMenu;
