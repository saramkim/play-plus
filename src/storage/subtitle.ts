import { REGISTRATION } from '../utils/constants';
import { SubtitleData } from '../utils/subtitle';

type Uuid = `${string}-${string}-${string}-${string}-${string}`;
export type SubtitleId = `${typeof REGISTRATION.ID_PREFIX}-${Uuid}`;

export const setLocalSubtitle = (id: SubtitleId, data: SubtitleData[]) => {
  return chrome.storage.local.set({ [id]: data });
};

export const getLocalSubtitle = (id: SubtitleId): Promise<SubtitleData[]> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(id, (result) => {
      resolve(result[id]);
    });
  });
};

export const removeLocalSubtitle = (id: SubtitleId) => {
  return chrome.storage.local.remove(id);
};
