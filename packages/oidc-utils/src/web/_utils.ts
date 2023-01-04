import { base64UrlEncode, sha256 } from "../core/lib/_utils";
import { AuthConfig, JWT } from "../core/types";

export const sha256Async = async (str: string) => {
  const encoder = new TextEncoder();

  const data = encoder.encode(str);

  const hash = await crypto.subtle.digest("SHA-256", data);

  const asciiOutput = String.fromCharCode(...Array.from(new Uint8Array(hash)));

  return asciiOutput;
};

export const redirectTo = (url: string) => {
  location.href = url;
};

export const replaceUrlState = (url: string) => {
  history.replaceState({}, "", url);
};

export const getCurrentUrl = () => {
  return location.href;
};

export const getCurrentRoute = () => {
  return location.pathname;
};

export const getCurrentOrigin = () => {
  return location.origin;
};

export const getUrlWithoutParams = () => {
  return getCurrentOrigin() + getCurrentRoute();
};

export const getQueryParams = () => {
  return new URLSearchParams(location.search);
};

export const isHttps = (url: string) => {
  return url.startsWith("https://");
};

export const createRandomString = (length: number) => {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  const randomASCIIString = String.fromCharCode(...bytes);

  return randomASCIIString;
};

export const createNonce = (length: number) => {
  const randomASCIIString = createRandomString(length);

  const nonce = base64UrlEncode(randomASCIIString);

  return nonce;
};

export const createVerifierAndChallengePair = (length: number = 32) => {
  const verifier = createNonce(length);

  const challenge = base64UrlEncode(sha256(verifier, "ascii"));

  return [verifier, challenge];
};

export const isAuthCallback = (
  authConfig: AuthConfig,
  useState = true,
  responseType: "code" = "code",
) => {
  const params = getQueryParams();

  const currentUrl = getUrlWithoutParams();

  if (currentUrl !== authConfig.redirectUri) return false;

  if (responseType === "code") {
    if (!params.has("code")) return false;
  }

  if (useState) {
    if (!params.has("state")) return false;
  }

  return true;
};

export const createIFrame = (id: string, source: string) => {
  const iframeIfExists = document.getElementById(id);

  if (iframeIfExists) iframeIfExists.remove();

  const iframe = document.createElement("iframe");

  iframe.setAttribute("id", id);
  iframe.setAttribute("src", source);
  iframe.setAttribute("style", "display: none");

  document.body.appendChild(iframe);

  return iframe;
};

export const createSessionCheckPostMessage = (
  clientId: string,
  session_state: string,
) => {
  return clientId + " " + session_state;
};
