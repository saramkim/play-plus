import { z } from 'zod';

import { Language, REVIEW } from '@utils/constants';

import { savedSubtitleSchema, storedSavedSubtitleSchema } from './schema';
import { LegacySavedSubtitle, SavedSubtitle, SavedSubtitleReviewStatus } from './type';

import { getLocalStorage, setLocalStorage } from './index';

export interface SavedSubtitleLineInput {
  text: string;
  language?: Language;
}

export interface SavedSubtitleDraft {
  primary: SavedSubtitleLineInput;
  secondary?: SavedSubtitleLineInput;
  url: string;
  startTime: number;
}

export interface SavedSubtitleDeletion {
  card: SavedSubtitle;
  index: number;
}

interface BuildSavedSubtitleDraftInput {
  primary?: SavedSubtitleLineInput;
  secondary?: SavedSubtitleLineInput;
  url: string;
  startTime: number;
}

interface MigrationResult {
  cards: SavedSubtitle[];
  migrated: boolean;
}

const storedSavedSubtitlesSchema = z.array(storedSavedSubtitleSchema);

export const createSavedSubtitleId = () => `saved-${crypto.randomUUID()}`;

export const buildSavedSubtitleDraft = ({
  primary,
  secondary,
  url,
  startTime,
}: BuildSavedSubtitleDraftInput): SavedSubtitleDraft => {
  if (!primary && !secondary) throw new Error('At least one saved subtitle line is required');
  const primaryLine = normalizeLine(primary ?? secondary!)!;
  const secondaryLine = primary ? normalizeLine(secondary) : undefined;

  return {
    primary: primaryLine,
    ...(secondaryLine ? { secondary: secondaryLine } : {}),
    url,
    startTime,
  };
};

export const createSavedSubtitleCard = (
  draft: SavedSubtitleDraft,
  id = createSavedSubtitleId(),
  savedAt = new Date().toISOString()
): SavedSubtitle => savedSubtitleSchema.parse({ id, ...draft, reviewStatus: 'new', savedAt });

export const isSameSavedSubtitleCard = (card: SavedSubtitle, draft: SavedSubtitleDraft) => {
  return (
    card.url === draft.url &&
    card.startTime === draft.startTime &&
    isSameLine(card.primary, draft.primary) &&
    isSameOptionalLine(card.secondary, draft.secondary)
  );
};

export const findSavedSubtitleCard = (cards: SavedSubtitle[], draft: SavedSubtitleDraft) => {
  return cards.find((card) => isSameSavedSubtitleCard(card, draft));
};

export const getSavedSubtitleSearchText = (card: SavedSubtitle) => {
  return [card.primary.text, card.secondary?.text].filter(Boolean).join('\n');
};

export const removeSavedSubtitleById = (cards: SavedSubtitle[], id: string) => {
  const index = cards.findIndex((card) => card.id === id);
  if (index < 0) return { cards, removed: undefined, index };

  return {
    cards: cards.filter((card) => card.id !== id),
    removed: cards[index],
    index,
  };
};

export const restoreSavedSubtitleAt = (cards: SavedSubtitle[], card: SavedSubtitle, index: number) => {
  if (cards.some(({ id }) => id === card.id)) return cards;

  const restored = [...cards];
  restored.splice(Math.max(0, Math.min(index, restored.length)), 0, card);
  return restored;
};

export const setSavedSubtitleReviewStatus = (
  cards: SavedSubtitle[],
  id: string,
  reviewStatus: SavedSubtitleReviewStatus
) => {
  const index = cards.findIndex((card) => card.id === id);
  if (index < 0) return cards;

  const updated = [...cards];
  updated[index] = savedSubtitleSchema.parse({ ...cards[index], reviewStatus });
  return updated;
};

export const migrateSavedSubtitles = (
  value: unknown,
  createId: (legacy: LegacySavedSubtitle, index: number) => string = createLegacySavedSubtitleId
): MigrationResult => {
  const stored = storedSavedSubtitlesSchema.parse(value ?? []);
  let migrated = false;
  const cards = stored.map((entry, index) => {
    if ('reviewStatus' in entry) return entry;

    migrated = true;
    if ('id' in entry) return savedSubtitleSchema.parse({ ...entry, reviewStatus: 'new' });
    return migrateLegacySavedSubtitle(entry, createId(entry, index));
  });

  return { cards, migrated };
};

export const getSavedSubtitleCards = async (
  createId: (legacy: LegacySavedSubtitle, index: number) => string = createLegacySavedSubtitleId
) => {
  const stored = (await getLocalStorage(REVIEW.STORAGE_KEY)) as unknown;
  const result = migrateSavedSubtitles(stored, createId);
  if (result.migrated) await setLocalStorage(REVIEW.STORAGE_KEY, result.cards);
  return result.cards;
};

const setSavedSubtitleCards = (cards: SavedSubtitle[]) => {
  return setLocalStorage(REVIEW.STORAGE_KEY, cards);
};

export const addSavedSubtitleCard = async (draft: SavedSubtitleDraft) => {
  const cards = await getSavedSubtitleCards();
  if (findSavedSubtitleCard(cards, draft)) return undefined;

  const card = createSavedSubtitleCard(draft);
  await setSavedSubtitleCards([card, ...cards]);
  return card;
};

// Fresh reads avoid stale UI snapshots, but Chrome Storage offers no cross-context CAS transaction.
export const deleteSavedSubtitleCard = async (id: string): Promise<SavedSubtitleDeletion | undefined> => {
  const cards = await getSavedSubtitleCards();
  const { cards: remainingCards, removed, index } = removeSavedSubtitleById(cards, id);
  if (!removed) return undefined;

  await setSavedSubtitleCards(remainingCards);
  return { card: removed, index };
};

export const restoreSavedSubtitleCard = async ({ card, index }: SavedSubtitleDeletion) => {
  const cards = await getSavedSubtitleCards();
  const restoredCards = restoreSavedSubtitleAt(cards, card, index);
  if (restoredCards === cards) return undefined;

  await setSavedSubtitleCards(restoredCards);
  return card;
};

export const updateSavedSubtitleReviewStatus = async (
  id: string,
  reviewStatus: SavedSubtitleReviewStatus
) => {
  const cards = await getSavedSubtitleCards();
  const updated = setSavedSubtitleReviewStatus(cards, id, reviewStatus);
  if (updated === cards) return undefined;

  await setSavedSubtitleCards(updated);
  return updated.find((card) => card.id === id);
};

const migrateLegacySavedSubtitle = (legacy: LegacySavedSubtitle, id: string): SavedSubtitle =>
  savedSubtitleSchema.parse({
    id,
    primary: { text: legacy.content },
    reviewStatus: 'new',
    url: legacy.url,
    startTime: legacy.startTime,
    savedAt: legacy.savedAt,
  });

const createLegacySavedSubtitleId = (legacy: LegacySavedSubtitle, index: number) => {
  const source = JSON.stringify([legacy.content, legacy.url, legacy.startTime, legacy.savedAt, index]);
  return `saved-legacy-${hashText(source, 2166136261)}-${hashText(source, 3339675911)}`;
};

const hashText = (value: string, seed: number) => {
  let hash = seed;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const isSameLine = (left: SavedSubtitleLineInput, right: SavedSubtitleLineInput) => {
  return left.text === right.text && left.language === right.language;
};

const isSameOptionalLine = (left?: SavedSubtitleLineInput, right?: SavedSubtitleLineInput) => {
  if (!left || !right) return left === right;
  return isSameLine(left, right);
};

const normalizeLine = (line?: SavedSubtitleLineInput): SavedSubtitleLineInput | undefined => {
  if (!line) return undefined;
  return {
    text: line.text,
    ...(line.language ? { language: line.language } : {}),
  };
};
