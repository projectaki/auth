import { AppStateParams } from "@auth/oidc-utils";
import { StorageService } from "./storage-service";

export const createStorageWrapper = (storage: StorageService) => {
  const CACHE_KEY = "HW*!p!5Ie%VmHLf%935P4NisfE9";

  const get = async <K extends keyof AppStateParams>(key: K) => {
    const cache = await storage.get<AppStateParams>(CACHE_KEY);

    if (!cache) return null;

    return cache[key];
  };

  const getAll = async () => {
    return await storage.get<Partial<AppStateParams>>(CACHE_KEY);
  };

  const set = async <K extends keyof AppStateParams>(key: K, value: any) => {
    let cache = (await storage.get<Partial<AppStateParams>>(CACHE_KEY)) ?? {};

    cache[key] = value;

    await storage.set(CACHE_KEY, cache);
  };

  const setMany = async <K extends keyof AppStateParams>(value: any) => {
    let cache = (await storage.get<Partial<AppStateParams>>(CACHE_KEY)) ?? {};

    await storage.set(CACHE_KEY, { ...cache, ...value });
  };

  const remove = async <K extends keyof AppStateParams>(key: K) => {
    const cache = (await storage.get<Partial<AppStateParams>>(CACHE_KEY)) || {};

    delete cache[key];

    await storage.set(CACHE_KEY, cache);
  };

  const clear = async () => {
    await storage.remove(CACHE_KEY);
  };

  return {
    get,
    getAll,
    set,
    remove,
    clear,
  };
};
