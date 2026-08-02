import { t } from '@utils/i18n';

import { LearningProfile, LearningProfileForm } from './learning-profile-form';

interface LearningProfileConfirmationProps {
  onConfirm: (value: LearningProfile) => void | Promise<void>;
  value: LearningProfile;
}

export function LearningProfileConfirmation({ onConfirm, value }: LearningProfileConfirmationProps) {
  return (
    <LearningProfileForm
      description={t('learning_profile_confirmation_description')}
      onSubmit={onConfirm}
      submitLabel={t('confirm_languages')}
      title={t('learning_profile_confirmation_title')}
      value={value}
    />
  );
}
