declare global {
  type KeyOfUnion<T> = T extends T ? keyof T : never;
  interface ObjectConstructor {
    entries<T extends Record<string, any>>(obj: T): [KeyOfUnion<T>, T[KeyOfUnion<T>]][];
    keys<T extends Record<string, any>>(obj: T): KeyOfUnion<T>[];
  }
}

export {};
