import { AuthConfig, createCoreClient, createFetchService, ExtraQueryParams } from "@authts/client-core";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Random from "expo-random";

const expoActions = {
  async parseUrl() {
    const url = await Linking.getInitialURL();
    return url!;
  },
  randomBytes(size: number) {
    return Random.getRandomBytes(size);
  },
  async redirect(url: string) {
    const result = await WebBrowser.openAuthSessionAsync(url);

    return result.type === "success" ? result.url : undefined;
  },
  replaceUrlState(url: string) {},
};

const expoStorage = {
  get(key: string) {
    return AsyncStorage.getItem(key);
  },
  remove(key: string) {
    return AsyncStorage.removeItem(key);
  },
  set(key: string, value: string) {
    return AsyncStorage.setItem(key, value);
  },
};

export const createExpoClient = (config: AuthConfig) => {
  const coreClient = createCoreClient({
    authConfig: config,
    adapters: {
      httpService: createFetchService(),
      ...expoActions,
      storage: expoStorage as any,
    },
  });

  return {
    ...coreClient,
    signIn: async (extraParams?: ExtraQueryParams | undefined) => {
      const result = await coreClient.signIn(extraParams);

      if (result) {
        coreClient.authCallback(result);
      }
    },
  };
};

export type ExpoClient = ReturnType<typeof createExpoClient>;
