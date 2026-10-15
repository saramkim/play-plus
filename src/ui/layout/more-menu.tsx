import { useRef } from 'react';

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

export function MoreMenu({ onFeedback }: { onFeedback: (trigger: HTMLElement) => void }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const openingFeedback = useRef(false);
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
        <Button ref={trigger} data-feedback-menu-trigger aria-label={t('feedback_more_menu')} variant='ghost' size='icon'>
          <EllipsisIcon className='size-6' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onCloseAutoFocus={(event) => {
        if (openingFeedback.current) {
          event.preventDefault();
          openingFeedback.current = false;
          if (trigger.current) onFeedback(trigger.current);
        }
      }}>
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onClick={() => menuMap[option.value]()}>
            {option.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => {
          openingFeedback.current = true;
        }}>{t('feedback_open')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
