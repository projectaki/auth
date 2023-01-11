import { AuthConfig, createCoreClient, ExtraQueryParams, HttpService } from "@authts/core";

const expoActions = {
  async parseUrl() {
    const url = location.href;

    return url!;
  },
  randomBytes(size: number) {
    const bytes = new Uint8Array(size);
    crypto.getRandomValues(bytes);

    return bytes;
  },
  async redirect(url: string) {
    location.href = url;
  },
  replaceUrlState(url: string) {
    history.replaceState({}, "", url);
  },
};

const createFetchService = (): HttpService => {
  const get = async <T,>(url: string, headers?: { [key: string]: string }): Promise<T> => {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    return response.json();
  };

  const post = async <T,>(url: string, body: any, headers?: { [key: string]: string }): Promise<T> => {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
    });

    return response.json();
  };

  return {
    get,
    post,
  };
};

const WebStorage = {
  get(key: string) {
    const val = sessionStorage.getItem(key);

    return val;
  },

  remove(key: string) {
    sessionStorage.removeItem(key);
  },

  set(key: string, value: string) {
    sessionStorage.setItem(key, value);
  },
};

export const createWebClient = (config: AuthConfig) => {
  const coreClient = createCoreClient({
    authConfig: config,
    adapters: {
      httpService: createFetchService(),
      ...expoActions,
      storage: WebStorage,
      secureStorage: WebStorage,
    },
  });

  return coreClient;
};

export type WebClient = ReturnType<typeof createWebClient>;
