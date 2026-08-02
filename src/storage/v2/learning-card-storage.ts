import { learningCardSchema } from './schema';
import { LearningCard } from './type';

export interface V2LearningCardStorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

export interface V2LearningCardStorageApi {
  get: () => Promise<LearningCard[]>;
  add: (card: LearningCard) => Promise<LearningCard>;
}

export const createV2LearningCardStorage = (
  storage: V2LearningCardStorageArea
): V2LearningCardStorageApi => {
  let mutationQueue: Promise<void> = Promise.resolve();

  const get = async () => {
    const result = await storage.get('learningCards');
    return learningCardSchema.array().parse(result.learningCards);
  };

  const enqueueMutation = <T>(mutation: () => Promise<T>) => {
    const result = mutationQueue.then(mutation);
    mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };

  return {
    get,
    add: async (card) => {
      const parsedCard = learningCardSchema.parse(card);
      return enqueueMutation(async () => {
        const cards = await get();
        await storage.set({ learningCards: [...cards, parsedCard] });
        return parsedCard;
      });
    },
  };
};
