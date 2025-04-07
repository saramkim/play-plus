import { clearStorage, setStorageAll } from '@storage/index';
import { LEARNING_CONFIG } from '@storage/preset';
import { MORE_MENU_OPTIONS } from '@utils/constants';
import { t } from '@utils/i18n';
import { EllipsisIcon } from 'lucide-react';

import { Button } from '@/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/components/dropdown-menu';
import { modal } from '@/ui/components/modal';

const { RESET_SETTINGS, SET_LEARNING_CONFIG } = MORE_MENU_OPTIONS;

export function MoreMenu() {
  const options = [
    { label: t('reset_settings'), value: RESET_SETTINGS },
    { label: t('optimize_for_learning'), value: SET_LEARNING_CONFIG },
  ];

  const resetSettings = () => {
    modal.confirm({
      title: t('reset_settings'),
      message: t('reset_settings_confirm'),
      onConfirm: clearStorage,
    });
  };

  const optimizeForLearning = () => {
    modal.confirm({
      title: t('optimize_for_learning'),
      message: t('optimize_for_learning_confirm'),
      onConfirm: () => setStorageAll(LEARNING_CONFIG),
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
          <EllipsisIcon className='size-6' />
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
