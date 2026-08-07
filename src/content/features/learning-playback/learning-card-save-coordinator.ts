import type { LearningCard } from '@storage/v2/type';
import { sendMessage } from '@utils/message';

export type LearningCardSaveResult =
  | { status: 'saved'; card: LearningCard }
  | { status: 'busy' }
  | { status: 'card-unavailable' }
  | { status: 'error' };

type LearningCardFactory = () => LearningCard | null | undefined;

let savePending = false;

export const saveLearningCard = async (
  createCard: LearningCardFactory
): Promise<LearningCardSaveResult> => {
  if (savePending) return { status: 'busy' };
  savePending = true;

  try {
    const card = createCard();
    if (!card) return { status: 'card-unavailable' };

    const response = await sendMessage('addLearningCard', { card });
    return response.success ? { status: 'saved', card } : { status: 'error' };
  } catch {
    return { status: 'error' };
  } finally {
    savePending = false;
  }
};
