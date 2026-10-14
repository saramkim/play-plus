import { Language, REGISTRATION } from '@utils/constants';
import { SubtitleData } from '@utils/parse';

import { subtitleMetadataSchema } from './schema';
import { SubtitleId } from './subtitle';
import { SubtitleMetadata } from './type';

let mutationQueue: Promise<void> = Promise.resolve();

// Serializes this context only. Chrome Storage does not provide cross-context CAS.
const enqueueMutation = <T>(mutation: () => Promise<T>) => {
  const result = mutationQueue.then(mutation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
};

export const getRegisteredSubtitles = async (): Promise<SubtitleMetadata[]> => {
  const values = await chrome.storage.local.get(REGISTRATION.STORAGE_KEY);
  const original: unknown = values[REGISTRATION.STORAGE_KEY] ?? [];
  subtitleMetadataSchema.array().parse(original);
  // Validate without replacing the original: Zod strips unknown metadata fields.
  return original as SubtitleMetadata[];
};

export const addRegisteredSubtitle = (draft: { title: string; language: Language; body: SubtitleData[] }) =>
  enqueueMutation(async () => {
    const subtitles = await getRegisteredSubtitles();
    const id: SubtitleId = `${REGISTRATION.ID_PREFIX}-${crypto.randomUUID()}`;
    const existing = await chrome.storage.local.get(id);
    if (subtitles.some(item => item.id === id) || existing[id] !== undefined) {
      throw new Error('Registered subtitle ID already exists');
    }
    const metadata: SubtitleMetadata = {
      id, title: draft.title, language: draft.language, savedAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [REGISTRATION.STORAGE_KEY]: [...subtitles, metadata], [id]: draft.body });
    return metadata;
  });

export const updateRegisteredSubtitle = (id: SubtitleId, updates: Partial<Pick<SubtitleMetadata, 'title' | 'language' | 'delay'>>) =>
  enqueueMutation(async () => {
    const subtitles = await getRegisteredSubtitles();
    const current = subtitles.find(item => item.id === id);
    if (!current) throw new Error('Registered subtitle not found');
    const updated = {
      ...current,
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.language !== undefined ? { language: updates.language } : {}),
      ...(updates.delay !== undefined ? { delay: updates.delay } : {}),
    };
    await chrome.storage.local.set({
      [REGISTRATION.STORAGE_KEY]: subtitles.map(item => item.id === id ? updated : item),
    });
    return updated;
  });

export class SubtitleDeleteRecoveryError extends Error {
  constructor(readonly deletionError: unknown, readonly recoveryError: unknown) {
    super('Subtitle deletion failed and its body could not be restored');
    this.name = 'SubtitleDeleteRecoveryError';
  }
}

export const deleteRegisteredSubtitle = (id: SubtitleId) => enqueueMutation(async () => {
  const subtitles = await getRegisteredSubtitles();
  if (!subtitles.some(item => item.id === id)) return;
  const backup = await chrome.storage.local.get(id);
  await chrome.storage.local.remove(id);
  try {
    const latest = await getRegisteredSubtitles();
    await chrome.storage.local.set({ [REGISTRATION.STORAGE_KEY]: latest.filter(item => item.id !== id) });
  } catch (deletionError) {
    try {
      if (backup[id] !== undefined) {
        const current = await chrome.storage.local.get(id);
        if (current[id] !== undefined) throw new Error('Subtitle body changed during deletion');
        await chrome.storage.local.set({ [id]: backup[id] });
      }
    } catch (recoveryError) {
      throw new SubtitleDeleteRecoveryError(deletionError, recoveryError);
    }
    throw deletionError;
  }
});
