declare global {
  interface ObjectConstructor {
    entries<T extends Record<string, any>>(obj: T): [keyof T, T[keyof T]][];
    keys<T extends Record<string, any>>(obj: T): Array<keyof T>;
  }
}

export {};
