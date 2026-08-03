import type {
  DeletedLearningCard,
  V2LearningCardStorageApi,
} from '@storage/v2/learning-card-storage';
import type { LearningCard } from '@storage/v2/type';
import { sendMessage } from '@utils/message';
import type { MessageResponse } from '@utils/message';
import type { MessageSchema } from '@utils/message/type';

type LearningCardMessage =
  | 'getLearningCards'
  | 'addLearningCard'
  | 'updateLearningCard'
  | 'deleteLearningCard'
  | 'restoreLearningCard';

type MessageArgs<M extends LearningCardMessage> = MessageSchema[M] extends { params: infer Params }
  ? [params: Params]
  : [];

export type LearningCardMessageSender = <M extends LearningCardMessage>(
  message: M,
  ...args: MessageArgs<M>
) => Promise<MessageResponse<M>>;

type LearningCardResponse<T> = { success: true; data: T } | { success: false; message: string };

const OPERATION_FAILED_MESSAGE = 'Learning card operation failed';
const sendLearningCardMessage = sendMessage as LearningCardMessageSender;

export const createMessageLearningCardStorage = (
  sender: LearningCardMessageSender = sendLearningCardMessage
): V2LearningCardStorageApi => ({
  get: () => unwrap(sender('getLearningCards')),
  add: (card: LearningCard) => unwrap(sender('addLearningCard', { card })),
  update: (id: string, card: LearningCard) =>
    unwrap(sender('updateLearningCard', { id, card })),
  delete: (id: string) => unwrap(sender('deleteLearningCard', { id })),
  restore: (deleted: DeletedLearningCard) =>
    unwrap(sender('restoreLearningCard', { deleted })),
});

const unwrap = async <T>(request: Promise<LearningCardResponse<T>>): Promise<T> => {
  try {
    const response = await request;
    if (response.success) return response.data;
  } catch {
    // Runtime and background errors share one non-sensitive UI boundary.
  }

  throw new Error(OPERATION_FAILED_MESSAGE);
};
