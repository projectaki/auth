export type StorageService = {
  get<T>(key: string): T | Promise<T | null> | null;
  set<T>(key: string, value: T): void | Promise<void>;
  remove(key: string): void | Promise<void>;
  clear(): void | Promise<void>;
};
