import { createCoreClient } from "@authts/client-core";

const expoActions = {
  authStateChange(authState: any) {
    console.log("authStateChange", authState);
  },
  parseUrl() {
    console.log("parseUrl");
    return "";
  },
  randomBytes(size: number) {
    return new Uint8Array(size);
  },
  redirect(url: string) {
    console.log("redirect", url);
  },
  replaceUrlState(url: string) {
    console.log("replaceUrlState", url);
  },
};

const expoFetch = {
  get(url: any, headers: any) {
    return { data: "" } as any;
  },
  post(url: any, body: any, headers: any) {
    return { data: "" } as any;
  },
};

const expoStorage = {
  get(key: any) {
    return "" as any;
  },
  clear() {},
  remove(key: any) {},
  set(key: any, value: any) {},
};

export const createExpoClient = (config: any, x: (a: any) => void) =>
  createCoreClient({
    actions: { ...expoActions, authStateChange: x },
    authConfig: config,
    httpService: expoFetch,
    storage: expoStorage,
    logger: {
      error(message, ...optionalParams) {},
      log(message, ...optionalParams) {},
      warn(message, ...optionalParams) {},
    },
  });
