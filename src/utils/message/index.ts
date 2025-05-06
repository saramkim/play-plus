import { MessageSchema } from './type';

type Message = keyof MessageSchema;
type Params<M extends Message> = MessageSchema[M] extends { params: infer P } ? P : never;
type Response<M extends Message> = MessageSchema[M] extends { response: infer R } ? R : void;
export type MessageResponse<M extends Message> =
  | (Response<M> extends void ? { success: true } : { success: true; data: Response<M> })
  | { success: false; message: string };

export function sendMessage<M extends Message>(
  message: M,
  ...args: Params<M> extends never ? [] : [params: Params<M>]
): Promise<MessageResponse<M>> {
  const params = args[0];
  return chrome.runtime.sendMessage(params ? { message, params } : { message });
}

export const sendMessageToTab = <M extends Message>(
  tabId: number,
  message: M,
  ...args: Params<M> extends never ? [] : [params: Params<M>]
): Promise<MessageResponse<M>> => {
  const params = args[0];
  return chrome.tabs.sendMessage(tabId, params ? { message, params } : { message });
};

type MessageCallback = <M extends Message>({
  message,
  params,
  sender,
  sendResponse,
}: M extends M
  ? {
      message: M;
      params: Params<M>;
      sender: chrome.runtime.MessageSender;
      sendResponse: (response: MessageResponse<M>) => void;
    }
  : never) => void;

export const onMessage = (callback: MessageCallback) => {
  const { onMessage } = chrome.runtime;
  const listener = (
    request: { message: Message; params: Params<Message> },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<Message>) => void
  ) => {
    const { message, params } = request;
    return callback({ message, params, sender, sendResponse });
  };
  onMessage.addListener(listener);
  return { remove: () => onMessage.removeListener(listener) };
};
