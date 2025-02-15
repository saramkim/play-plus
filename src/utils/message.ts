import { SubtitleId } from '@storage/subtitle';
import { SetSubtitleAction } from './constants';

export type FetchVideoMetadataMessage = {
  url: string;
  headers: chrome.webRequest.HttpHeader[];
};

export type PlayVideoMessage = {
  startTime: number;
};

export type ViewVideoMessage = {
  url: string;
  startTime: number;
};

export type SetSubtitleMessage = {
  tabId: number;
  subtitleId: SubtitleId | null;
};

type MessageData = {
  fetchVideoMetadata: FetchVideoMetadataMessage;
  playVideo: PlayVideoMessage;
  viewVideo: ViewVideoMessage;
  setPrimarySubtitle: SetSubtitleMessage;
  setSecondarySubtitle: SetSubtitleMessage;
};
type MessageKey = keyof MessageData;

export type MessageResponse = { success: true } | { success: false; message: string };

export const sendMessage = <T extends MessageKey>(action: T, data: MessageData[T]): Promise<MessageResponse> => {
  return chrome.runtime.sendMessage({ [action]: data });
};

export const sendMessageToTab = <T extends MessageKey>(
  tabId: number,
  action: T,
  data: MessageData[T]
): Promise<MessageResponse> => {
  return chrome.tabs.sendMessage(tabId, { [action]: data });
};

type MessageCallback = (
  message: Partial<MessageData>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
) => void;

export const onMessage = (callback: MessageCallback) => {
  chrome.runtime.onMessage.addListener(callback);
};
