import { learningCardSchema } from './schema';
import { LearningCard } from './type';

export interface V2LearningCardStorageArea {
  get: (keys?: string | string[] | null) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
}

export interface V2LearningCardStorageApi {
  get: () => Promise<LearningCard[]>;
  add: (card: LearningCard) => Promise<LearningCard>;
  update: (id: string, card: LearningCard) => Promise<LearningCard>;
  delete: (id: string) => Promise<DeletedLearningCard>;
  restore: (deleted: DeletedLearningCard) => Promise<LearningCard>;
}

export interface DeletedLearningCard {
  card: LearningCard;
  index: number;
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

  const write = async (cards: LearningCard[]) => {
    const parsedCards = learningCardSchema.array().parse(cards);
    await storage.set({ learningCards: parsedCards });
    return parsedCards;
  };

  const findCardIndex = (cards: LearningCard[], id: string) => {
    const matches = cards.reduce<number[]>((indexes, card, index) => {
      if (card.id === id) indexes.push(index);
      return indexes;
    }, []);

    if (matches.length === 0) throw new Error(`Learning card not found: ${id}`);
    if (matches.length > 1) throw new Error(`Duplicate learning card id: ${id}`);
    return matches[0];
  };

  return {
    get,
    add: async (card) => {
      return enqueueMutation(async () => {
        const cards = await get();
        const parsedCard = learningCardSchema.parse(card);
        if (cards.some(({ id }) => id === parsedCard.id)) {
          throw new Error(`Duplicate learning card id: ${parsedCard.id}`);
        }
        const nextCards = await write([...cards, parsedCard]);
        return nextCards[nextCards.length - 1];
      });
    },
    update: async (id, card) => {
      return enqueueMutation(async () => {
        const cards = await get();
        const index = findCardIndex(cards, id);
        const currentCard = cards[index];
        const parsedCard = learningCardSchema.parse(card);

        if (parsedCard.id !== id) throw new Error('A learning card update cannot change its id');
        if (parsedCard.createdAt !== currentCard.createdAt) {
          throw new Error('A learning card update cannot change its creation time');
        }
        if (!hasSameSource(parsedCard, currentCard)) {
          throw new Error('A learning card update cannot change its source');
        }

        const nextCards = [...cards];
        nextCards[index] = parsedCard;
        return (await write(nextCards))[index];
      });
    },
    delete: async (id) => {
      return enqueueMutation(async () => {
        const cards = await get();
        const index = findCardIndex(cards, id);
        const [card] = cards.splice(index, 1);
        await write(cards);
        return { card, index };
      });
    },
    restore: async ({ card, index }) => {
      return enqueueMutation(async () => {
        const cards = await get();
        const parsedCard = learningCardSchema.parse(card);

        if (!Number.isInteger(index) || index < 0) {
          throw new Error('A deleted learning card requires a non-negative integer index');
        }
        if (cards.some(({ id }) => id === parsedCard.id)) {
          throw new Error(`Duplicate learning card id: ${parsedCard.id}`);
        }

        const insertionIndex = Math.min(index, cards.length);
        const nextCards = [
          ...cards.slice(0, insertionIndex),
          parsedCard,
          ...cards.slice(insertionIndex),
        ];
        return (await write(nextCards))[insertionIndex];
      });
    },
  };
};

const hasSameSource = (left: LearningCard, right: LearningCard) =>
  left.source.url === right.source.url &&
  left.source.startTime === right.source.startTime &&
  left.source.endTime === right.source.endTime &&
  left.source.title === right.source.title;
