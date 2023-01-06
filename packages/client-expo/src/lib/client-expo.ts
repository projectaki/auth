import { AuthConfig, createCoreClient, createFetchService } from "@authts/client-core";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const expoActions = {
  async parseUrl() {
    const url = await Linking.getInitialURL();
    console.log("parseUrl", url);
    return url!;
  },
  randomBytes(size: number) {
    return new Uint8Array(size);
  },
  redirect(url: string) {
    console.log("redirect", url);
    WebBrowser.openBrowserAsync(url);
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

export const createExpoClient = (config: AuthConfig) =>
  createCoreClient({
    authConfig: config,
    adapters: {
      httpService: createFetchService(),
      ...expoActions,
      storage: expoStorage as any,
    },
  });

export type ExpoClient = ReturnType<typeof createExpoClient>;
