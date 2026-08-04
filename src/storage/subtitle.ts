import { registeredSubtitleIdSchema, subtitleCueSchema } from '@storage/v2/schema';
import { V2RegisteredSubtitleMetadata } from '@storage/v2/type';
import { SubtitleData } from '@utils/parse';

export type SubtitleId = V2RegisteredSubtitleMetadata['id'];

export const setLocalSubtitle = (id: SubtitleId, data: SubtitleData[]) => {
  const parsedId = registeredSubtitleIdSchema.parse(id);
  const parsedData = subtitleCueSchema.array().parse(data);
  return chrome.storage.local.set({ [parsedId]: parsedData });
};

export const getLocalSubtitle = async (id: SubtitleId): Promise<SubtitleData[]> => {
  const parsedId = registeredSubtitleIdSchema.parse(id);
  const result = await chrome.storage.local.get(parsedId);
  return subtitleCueSchema.array().parse(result[parsedId]);
};

export const removeLocalSubtitle = async (id: SubtitleId) => {
  const parsedId = registeredSubtitleIdSchema.parse(id);
  await getLocalSubtitle(id);
  await chrome.storage.local.remove(parsedId);
};
