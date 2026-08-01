import { Language, REGISTRATION } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

import { SubtitleId } from './subtitle';
import { SubtitleMetadata } from './type';

import { onLocalStorageChange } from './index';

export interface RegisteredSubtitleDraft {
  title: string;
  language: Language;
  body: SubtitleData[];
}

export interface RegisteredSubtitleUpdates {
  title?: string;
  language?: Language;
  delay?: number;
}

let mutationQueue: Promise<void> = Promise.resolve();

// This serializes mutations in one extension context; Chrome Storage has no cross-context CAS transaction.
const enqueueMutation = <T>(mutation: () => Promise<T>) => {
  const result = mutationQueue.then(mutation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
};

export const getRegisteredSubtitles = async () => {
  const result = await chrome.storage.local.get(REGISTRATION.STORAGE_KEY);
  return (result[REGISTRATION.STORAGE_KEY] as SubtitleMetadata[] | undefined) ?? [];
};

export const addRegisteredSubtitle = (draft: RegisteredSubtitleDraft) => {
  return enqueueMutation(async () => {
    const subtitles = await getRegisteredSubtitles();
    const id = createRegisteredSubtitleId();
    if (subtitles.some((subtitle) => subtitle.id === id)) {
      throw new Error(`Registered subtitle already exists: ${id}`);
    }

    const metadata: SubtitleMetadata = {
      id,
      title: draft.title,
      language: draft.language,
      savedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({
      [REGISTRATION.STORAGE_KEY]: [...subtitles, metadata],
      [id]: draft.body,
    });
    return metadata;
  });
};

export const updateRegisteredSubtitle = (id: SubtitleId, updates: RegisteredSubtitleUpdates) => {
  return enqueueMutation(async () => {
    const subtitles = await getRegisteredSubtitles();
    const index = subtitles.findIndex((subtitle) => subtitle.id === id);
    if (index < 0) return undefined;

    const current = subtitles[index];
    const updated: SubtitleMetadata = {
      ...current,
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.language !== undefined ? { language: updates.language } : {}),
      ...(updates.delay !== undefined ? { delay: updates.delay } : {}),
    };
    const nextSubtitles = [...subtitles];
    nextSubtitles[index] = updated;
    await chrome.storage.local.set({ [REGISTRATION.STORAGE_KEY]: nextSubtitles });
    return updated;
  });
};

export const deleteRegisteredSubtitle = (id: SubtitleId) => {
  return enqueueMutation(async () => {
    const subtitles = await getRegisteredSubtitles();
    const index = subtitles.findIndex((subtitle) => subtitle.id === id);
    if (index < 0) return undefined;

    const deleted = subtitles[index];
    await chrome.storage.local.set({
      [REGISTRATION.STORAGE_KEY]: subtitles.filter((subtitle) => subtitle.id !== id),
    });
    await chrome.storage.local.remove(id);
    return deleted;
  });
};

export const onRegisteredSubtitlesChange = (callback: (subtitles: SubtitleMetadata[]) => void) => {
  return onLocalStorageChange((changes) => {
    const change = changes[REGISTRATION.STORAGE_KEY];
    if (!change) return;
    callback(change.newValue ?? []);
  });
};

const createRegisteredSubtitleId = () => {
  return `${REGISTRATION.ID_PREFIX}-${crypto.randomUUID()}` as SubtitleId;
};
