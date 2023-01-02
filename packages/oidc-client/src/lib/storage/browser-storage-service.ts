import { StorageService } from './storage-service';

export class BrowserStorageService implements StorageService {
  constructor(private storage: Storage = sessionStorage) {}

  get<T>(key: string): T | null {
    const value = this.storage.getItem(key);
    if (!value) return null;
    return JSON.parse(value);
  }

  set<T>(key: string, value: T): void {
    const stringified = JSON.stringify(value);
    this.storage.setItem(key, stringified);
  }

  remove(key: string): void {
    this.storage.removeItem(key);
  }

  clear(): void {
    this.storage.clear();
  }
}
