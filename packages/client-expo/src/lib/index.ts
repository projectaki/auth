import { AuthConfig, createCoreClient, ExtraQueryParams, HttpService } from "@authts/core";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Random from "expo-random";
import { Platform } from "react-native";
import { createWebClient } from "@authts/client-web";

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

const createFetchService = (): HttpService => {
  const get = async <T>(url: string, headers?: { [key: string]: string }): Promise<T> => {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    return response.json();
  };

  const post = async <T>(url: string, body: any, headers?: { [key: string]: string }): Promise<T> => {
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

const ExpoSecureStorage = {
  async get(key: string) {
    const val = await SecureStore.getItemAsync(key);
    if (key === "jwks") console.log(val);
    return val;
  },

  remove(key: string) {
    return SecureStore.deleteItemAsync(key);
  },

  set(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
};

const ExpoAsyncStorage = {
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
  if (Platform.OS === "web") {
    return createWebClient(config);
  }

  const coreClient = createCoreClient({
    authConfig: config,
    adapters: {
      httpService: createFetchService(),
      ...expoActions,
      storage: ExpoAsyncStorage,
      secureStorage: ExpoSecureStorage,
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
