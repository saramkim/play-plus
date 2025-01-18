import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import Dropdown, { Direction } from '../components/Dropdown';
import { getMessage } from '../utils/i18n';
import { MORE_MENU_OPTIONS } from '../utils/constants';
import { clearStorage } from '../storage/storage';
import { usePopup } from '../contexts/PopupContext';
import MessagePopup from '../components/MessagePopup';

interface MoreMenuProps {
  direction: Direction;
}

const { RESET_SETTINGS } = MORE_MENU_OPTIONS;

function MoreMenu({ direction }: MoreMenuProps) {
  const { showPopup, hidePopup } = usePopup();
  const options = [{ label: getMessage('reset_settings'), value: RESET_SETTINGS }];

  const resetSettings = () => {
    showPopup({
      title: getMessage('reset_settings'),
      content: (
        <MessagePopup
          message={getMessage('reset_settings_confirm')}
          type='confirm'
          onConfirm={clearStorage}
          hidePopup={hidePopup}
        />
      ),
      status: 'confirm',
    });
  };

  const menuMap = {
    [RESET_SETTINGS]: resetSettings,
  };

  return (
    <Dropdown direction={direction} options={options} onClick={(value) => menuMap[value]()}>
      {({ isOpen, toggleDropdown }) => (
        <button
          onClick={toggleDropdown}
          className={`flex items-center justify-center size-7 rounded-full ${
            isOpen ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          <EllipsisHorizontalIcon className='size-6 text-gray-800' />
        </button>
      )}
    </Dropdown>
  );
}

export default MoreMenu;
