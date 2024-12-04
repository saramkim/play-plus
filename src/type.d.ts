import { TemplateResult } from 'lit-html';

declare global {
  interface ObjectConstructor {
    entries<T extends Record<string, any>>(obj: T): [keyof T, T[keyof T]][];
    keys<T extends Record<string, any>>(obj: T): Array<keyof T>;
  }

  interface Component {
    init(): Promise<void> | void;
    html(): TemplateResult;
  }
}

export {};
