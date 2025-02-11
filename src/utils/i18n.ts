import messagesEn from '../../public/_locales/en/messages.json';
import messagesKo from '../../public/_locales/ko/messages.json';

type ExtractKeys<T> = {
  [K in keyof T]: T[K] extends { placeholders: Record<string, { content: string }> } ? string[] : [];
};

type I18nKeys = ExtractKeys<typeof messagesKo | typeof messagesEn>;

export const t = <K extends keyof I18nKeys>(key: K, ...args: I18nKeys[K]): string => {
  return chrome.i18n.getMessage(key, args);
};
