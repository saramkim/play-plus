import { registeredSubtitleIdSchema, registeredSubtitleMetadataSchema, subtitleCueSchema } from '@storage/v2/schema';
import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { REGISTRATION } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

import { getLocalSubtitle, SubtitleId } from './subtitle';

export interface RegisteredSubtitleDraft {
  title: string;
  language: V2RegisteredSubtitleMetadata['language'];
  body: SubtitleData[];
}

export type RegisteredSubtitleUpdates = Partial<
  Pick<V2RegisteredSubtitleMetadata, 'delay' | 'language' | 'title'>
>;

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
  return registeredSubtitleMetadataSchema.array().parse(result[REGISTRATION.STORAGE_KEY]);
};

export const addRegisteredSubtitle = (draft: RegisteredSubtitleDraft) => {
  return enqueueMutation(async () => {
    const subtitles = await getRegisteredSubtitles();
    const id = createRegisteredSubtitleId();
    const existingBody = await chrome.storage.local.get(id);
    if (subtitles.some((subtitle) => subtitle.id === id) || Object.prototype.hasOwnProperty.call(existingBody, id)) {
      throw new Error(`Registered subtitle already exists: ${id}`);
    }

    const metadata = registeredSubtitleMetadataSchema.parse({
      id,
      title: draft.title,
      language: draft.language,
      savedAt: new Date().toISOString(),
    });
    const body = subtitleCueSchema.array().parse(draft.body);
    await chrome.storage.local.set({
      [REGISTRATION.STORAGE_KEY]: [...subtitles, metadata],
      [id]: body,
    });
    return metadata;
  });
};

export const updateRegisteredSubtitle = (id: SubtitleId, updates: RegisteredSubtitleUpdates) => {
  return enqueueMutation(async () => {
    registeredSubtitleIdSchema.parse(id);
    const subtitles = await getRegisteredSubtitles();
    const index = subtitles.findIndex((subtitle) => subtitle.id === id);
    if (index < 0) throw new Error(`Registered subtitle not found: ${id}`);

    const current = subtitles[index];
    const updated = registeredSubtitleMetadataSchema.parse({
      ...current,
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.language !== undefined ? { language: updates.language } : {}),
      ...(updates.delay !== undefined ? { delay: updates.delay } : {}),
    });
    const nextSubtitles = [...subtitles];
    nextSubtitles[index] = updated;
    await chrome.storage.local.set({
      [REGISTRATION.STORAGE_KEY]: registeredSubtitleMetadataSchema.array().parse(nextSubtitles),
    });
    return updated;
  });
};

export const deleteRegisteredSubtitle = (id: SubtitleId) => {
  return enqueueMutation(async () => {
    registeredSubtitleIdSchema.parse(id);
    const subtitles = await getRegisteredSubtitles();
    const index = subtitles.findIndex((subtitle) => subtitle.id === id);
    if (index < 0) throw new Error(`Registered subtitle not found: ${id}`);

    const deleted = subtitles[index];
    const body = await getLocalSubtitle(id);
    await chrome.storage.local.set({
      [REGISTRATION.STORAGE_KEY]: registeredSubtitleMetadataSchema
        .array()
        .parse(subtitles.filter((subtitle) => subtitle.id !== id)),
    });
    try {
      await chrome.storage.local.remove(id);
    } catch (error) {
      await chrome.storage.local.set({
        [REGISTRATION.STORAGE_KEY]: subtitles,
        [id]: body,
      });
      throw error;
    }
    return deleted;
  });
};

export const onRegisteredSubtitlesChange = (callback: (subtitles: V2RegisteredSubtitleMetadata[]) => void) => {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    const change = changes[REGISTRATION.STORAGE_KEY];
    if (!change) return;
    callback(registeredSubtitleMetadataSchema.array().parse(change.newValue));
  };
  chrome.storage.local.onChanged.addListener(listener);
  return { remove: () => chrome.storage.local.onChanged.removeListener(listener) };
};

const createRegisteredSubtitleId = () => {
  return `${REGISTRATION.ID_PREFIX}-${crypto.randomUUID()}` as SubtitleId;
};
