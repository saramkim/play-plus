import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import { clearStorage, setStorageAll } from '@storage/index';
import { LEARNING_CONFIG } from '@storage/preset';
import { MORE_MENU_OPTIONS } from '@utils/constants';
import { t } from '@utils/i18n';

import { Button } from '@/ui/components/elements/button';
import { MessagePopup } from '@/ui/components/elements/message-popup';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/ui/dropdown-menu';
import { usePopup } from '@/ui/contexts/popup-context';

const { RESET_SETTINGS, SET_LEARNING_CONFIG } = MORE_MENU_OPTIONS;

export function MoreMenu() {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon'>
          <EllipsisHorizontalIcon className='size-7 ' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => menuMap[option.value]()}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
