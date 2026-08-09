import { MessageSchema } from './type';

type Message = keyof MessageSchema;
type Params<M extends Message> = MessageSchema[M] extends { params: infer P } ? P : never;
type MessageArgs<M extends Message> = M extends M
  ? Params<M> extends never
    ? []
    : [params: Params<M>]
  : never;
type MessageWithoutParams = {
  [M in Message]: Params<M> extends never ? M : never;
}[Message];
type MessageWithParams = Exclude<Message, MessageWithoutParams>;
type Response<M extends Message> = MessageSchema[M] extends { response: infer R } ? R : void;
type ErrorCode<M extends Message> = MessageSchema[M] extends { error: infer E } ? E : never;

export type AsyncMessageResponse<T, E = never> =
  | ([T] extends [void] ? { success: true } : { success: true; data: T })
  | ([E] extends [never]
      ? { success: false; message: string }
      : { success: false; message: string; code: E });

export type MessageResponse<M extends Message> = AsyncMessageResponse<Response<M>, ErrorCode<M>>;

export function sendMessage<M extends Message>(
  message: M,
  ...args: MessageArgs<M>
): Promise<MessageResponse<M>> {
  const params = args[0];
  return chrome.runtime.sendMessage(args.length > 0 ? { message, params } : { message });
}

export function sendMessageToTab<M extends MessageWithoutParams>(
  tabId: number,
  message: M
): Promise<MessageResponse<M>>;
export function sendMessageToTab<M extends MessageWithParams>(
  tabId: number,
  message: M,
  params: Params<M>
): Promise<MessageResponse<M>>;
export function sendMessageToTab(
  tabId: number,
  message: Message,
  params?: unknown
): Promise<MessageResponse<Message>> {
  return chrome.tabs.sendMessage(tabId, params === undefined ? { message } : { message, params });
}

type MessageRequest = {
  [M in Message]: {
    message: M;
    params: Params<M>;
    sender: chrome.runtime.MessageSender;
    sendResponse: (response: MessageResponse<M>) => void;
  };
}[Message];

type MessageCallback = (request: MessageRequest) => true | void;

export const onMessage = (callback: MessageCallback) => {
  const { onMessage } = chrome.runtime;
  const listener = (
    request: { message: Message; params: Params<Message> },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<Message>) => void
  ) => {
    const { message, params } = request;
    return callback({ message, params, sender, sendResponse } as MessageRequest);
  };
  onMessage.addListener(listener);
  return { remove: () => onMessage.removeListener(listener) };
};
