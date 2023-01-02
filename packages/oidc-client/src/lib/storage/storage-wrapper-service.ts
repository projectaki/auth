import { AppStateParams } from '../..';
import { BrowserStorageService } from './browser-storage-service';
import { StorageService } from './storage-service';

export class StorageWrapperService {
  private CACHE_KEY = 'HW*!p!5Ie%VmHLf%935P4NisfE9';

  constructor(private storage: StorageService = new BrowserStorageService()) {}

  public get<T>(key: string): T | undefined {
    const cache = this.storage.get<any>(this.CACHE_KEY);

    const val = cache && cache[key];

    return val;
  }

  public getAll() {
    const cache = this.storage.get<AppStateParams>(this.CACHE_KEY);

    return cache;
  }

  public set<T>(key: string, value: T): void {
    const cache = this.storage.get<any>(this.CACHE_KEY) || {};

    cache[key] = value;

    this.storage.set(this.CACHE_KEY, cache);
  }

  public remove(key: string): void {
    const cache = this.storage.get<any>(this.CACHE_KEY) || {};

    delete cache[key];
    
    this.storage.set(this.CACHE_KEY, cache);
  }

  public clear(): void {
    this.storage.remove(this.CACHE_KEY);
  }
}
