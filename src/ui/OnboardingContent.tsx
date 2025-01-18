import { LEARNING_CONFIG } from '../storage/preset';
import { setLocalStorage, setStorageAll } from '../storage/storage';
import { getMessage } from '../utils/i18n';

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
        <p>{getMessage('onboarding_description_1')}</p>
        <p>{getMessage('onboarding_description_2')}</p>
        <p>{getMessage('onboarding_description_3')}</p>
        <p className='text-[12px] text-gray-500'>{getMessage('onboarding_description_4')}</p>
      </div>
      <div className='flex gap-2 w-full'>
        <button className='button bg-gray-500 w-full' onClick={handleOnboardingComplete}>
          {getMessage('set_up_manually')}
        </button>
        <button className='button bg-teal-500 w-full' onClick={optimizeForLearning}>
          {getMessage('optimize_for_learning')}
        </button>
      </div>
    </div>
  );
}

export default OnboardingContent;
