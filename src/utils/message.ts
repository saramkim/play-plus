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

type MessageData = {
  fetchVideoMetadata: FetchVideoMetadataMessage;
  playVideo: PlayVideoMessage;
  viewVideo: ViewVideoMessage;
};
type MessageKey = keyof MessageData;

export const sendMessage = <T extends MessageKey>(action: T, data: MessageData[T]) => {
  return chrome.runtime.sendMessage({ [action]: data });
};

export const sendMessageToTab = <T extends MessageKey>(tabId: number, action: T, data: MessageData[T]) => {
  return chrome.tabs.sendMessage(tabId, { [action]: data });
};

export const onMessage = (callback: (message: Partial<MessageData>) => void) => {
  chrome.runtime.onMessage.addListener(callback);
};
