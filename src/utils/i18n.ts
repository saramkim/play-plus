import messages from '../../public/_locales/ko/messages.json';

type ExtractKeys<T> = {
  [K in keyof T]: T[K] extends { placeholders: Record<string, { content: string }> } ? string[] : [];
};

type I18nKeys = ExtractKeys<typeof messages>;

export const getMessage = <K extends keyof I18nKeys>(key: K, ...args: I18nKeys[K]): string => {
  return chrome.i18n.getMessage(key, args);
};
