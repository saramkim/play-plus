import { LEARNING_CONFIG } from '@storage/preset';
import { setLocalStorage, setStorageAll } from '@storage/index';
import { t } from '@utils/i18n';
import { Button } from '../elements/button';

interface OnboardingContentProps {
  hidePopup: () => void;
}

function OnboardingContent({ hidePopup }: OnboardingContentProps) {
  const handleOnboardingComplete = () => {
    hidePopup();
    setLocalStorage('isOnboardingComplete', true);
  };

  const optimizeForLearning = async () => {
    await setStorageAll(LEARNING_CONFIG);
    handleOnboardingComplete();
  };

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-col gap-2'>
        <p>{t('onboarding_description_1')}</p>
        <p>{t('onboarding_description_2')}</p>
        <p>{t('onboarding_description_3')}</p>
        <p className='text-[12px] text-gray-500'>{t('onboarding_description_4')}</p>
      </div>
      <div className='flex gap-2 w-full'>
        <Button variant='outline' className='w-full' onClick={handleOnboardingComplete}>
          {t('set_up_manually')}
        </Button>
        <Button className='w-full' onClick={optimizeForLearning}>
          {t('optimize_for_learning')}
        </Button>
      </div>
    </div>
  );
}

export default OnboardingContent;
