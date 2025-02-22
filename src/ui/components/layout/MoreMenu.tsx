import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import { LEARNING_CONFIG } from '@storage/preset';
import { clearStorage, setStorageAll } from '@storage/index';
import { MORE_MENU_OPTIONS } from '@utils/constants';
import { t } from '@utils/i18n';
import { usePopup } from '../../contexts/PopupContext';
import DropdownMenu from '../elements/DropdownMenu';
import MessagePopup from '../elements/MessagePopup';

const { RESET_SETTINGS, SET_LEARNING_CONFIG } = MORE_MENU_OPTIONS;

function MoreMenu() {
  const { showPopup, hidePopup } = usePopup();
  const options = [
    { label: t('reset_settings'), value: RESET_SETTINGS },
    { label: t('optimize_for_learning'), value: SET_LEARNING_CONFIG },
  ];

  const resetSettings = () => {
    showPopup({
      title: t('reset_settings'),
      content: (
        <MessagePopup
          message={t('reset_settings_confirm')}
          type='confirm'
          onConfirm={clearStorage}
          hidePopup={hidePopup}
        />
      ),
      status: 'confirm',
    });
  };

  const optimizeForLearning = () => {
    showPopup({
      title: t('optimize_for_learning'),
      content: (
        <MessagePopup
          message={t('optimize_for_learning_confirm')}
          type='confirm'
          onConfirm={() => setStorageAll(LEARNING_CONFIG)}
          hidePopup={hidePopup}
        />
      ),
      status: 'confirm',
    });
  };

  const menuMap = {
    [RESET_SETTINGS]: resetSettings,
    [SET_LEARNING_CONFIG]: optimizeForLearning,
  };

  return (
    <DropdownMenu
      options={options}
      onClick={(value) => menuMap[value]()}
      trigger={({ isOpen, toggleDropdown }) => (
        <button
          onClick={toggleDropdown}
          className={`flex items-center justify-center size-8 rounded-full ${
            isOpen ? 'bg-gray-200' : 'hover:bg-gray-100'
          }`}
        >
          <EllipsisHorizontalIcon className='size-7 text-gray-800' />
        </button>
      )}
    />
  );
}

export default MoreMenu;
