import { KJUR } from "jsrsasign";
import base64 from "react-native-base64";
import { Actions, AuthConfig, HttpService, JWT } from "./types";

export const typedObjectKeys = <T extends {}, K extends keyof T>(
  obj: T,
): K[] => {
  return Object.keys(obj) as K[];
};

export const dateNowMsSinceEpoch = () => {
  return Math.floor(Date.now() / 1000);
};

export const hexToBytes = (hex: string) => {
  const bytes = [];

  for (let c = 0; c < hex.length; c += 2) {
    bytes.push(parseInt(hex.slice(c, c + 2), 16));
  }

  return bytes;
};

export const sha256 = (str: string, returnType: "hex" | "ascii" = "hex") => {
  const hex = () => KJUR.crypto.Util.sha256(str);

  const asciiOutput = () => String.fromCharCode(...hexToBytes(hex()));

  return returnType === "ascii" ? asciiOutput() : hex();
};

export const base64Encode = (str: string) => {
  if (typeof btoa !== "undefined") {
    return btoa(str);
  } else if (typeof Buffer !== "undefined") {
    return Buffer.from(str).toString("base64");
  } else {
    return base64.encode(str);
  }
};

export const base64Decode = (str: string) => {
  if (typeof atob !== "undefined") {
    return atob(str);
  } else if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "base64").toString("ascii");
  } else {
    return base64.decode(str);
  }
};

export const base64UrlEncode = (str: string) =>
  base64Encode(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

export const base64UrlDecode = (str: string) => {
  const padding = str.length % 4;

  const pad = padding > 0 ? new Array(5 - padding).join("=") : "";

  return base64Decode(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
};

export const decodeJWt = (jwt: string): JWT => {
  const parts = jwt.split(".") as [string, string, string];

  if (parts.length !== 3) {
    throw new Error("Invalid JWT");
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));

    const payload = JSON.parse(base64UrlDecode(parts[1]));

    const signature = parts[2];

    return { header, payload, signature };
  } catch (e) {
    throw new Error("Id token is an invalid JWT, couldnt decode it");
  }
};

export const createRandomString = async (length: number, actions: Actions) => {
  const randomBytes = await actions.randomBytes(length);

  const randomASCIIString = String.fromCharCode(...randomBytes);

  return randomASCIIString;
};

export const trimTrailingSlash = (value: string) => {
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

export const createFetchService = (): HttpService => {
  const get = async <T>(
    url: string,
    headers?: { [key: string]: string },
  ): Promise<T> => {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    return response.json();
  };

  const post = async <T>(
    url: string,
    body: any,
    headers?: { [key: string]: string },
  ): Promise<T> => {
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
