import { KEYUTIL, KJUR } from "jsrsasign";
import {
  AuthConfig,
  JWK,
  JWT,
  AuthParams,
  ExtraQueryParams,
  Adapters,
  AuthBaseParams,
  StorageService,
  StorageWrapper,
  SecureStorageWrapper,
  StorageKey,
  SecureStorageKey,
  HttpService,
  Session,
  AuthResult,
} from "./types";

import {
  base64UrlEncode,
  sha256,
  base64UrlDecode,
  decodeJWt,
  dateNowMsSinceEpoch,
  typedObjectKeys,
  createRandomString,
  trimTrailingSlash,
} from "./_utils";

const SKEW_DEFAULT = 0;

export const createParamsFromConfig = (authConfig: AuthConfig, extraParams?: ExtraQueryParams) => {
  const authUrlParams: AuthBaseParams = {
    client_id: authConfig.clientId,
    redirect_uri: authConfig.redirectUri,
    response_type: authConfig.responseType,
    scope: authConfig.scope,
  };

  return { ...authUrlParams, ...authConfig.queryParams, ...extraParams };
};

export const createAuthUrl = (authConfig: AuthConfig, authUrlParams: AuthParams) => {
  const queryParams = new URLSearchParams();

  typedObjectKeys(authUrlParams).forEach((key) => {
    queryParams.append(key, authUrlParams[key]!.toString());
  });

  if (authUrlParams.code_challenge) queryParams.append("code_challenge_method", "S256");

  if (!authConfig.disableRefreshTokenConsent) {
    if (authUrlParams["scope"].split(" ").includes("offline_access")) queryParams.append("prompt", "consent");
  }

  const res = `${authConfig.discovery?.authorization_endpoint}?${queryParams.toString()}`;

  return res;
};

export const createTokenRequestBody = (authConfig: AuthConfig, code: string, codeVerifier: string) => {
  const urlSearchParam = new URLSearchParams();

  urlSearchParam.append("grant_type", "authorization_code");
  urlSearchParam.append("code", code);
  urlSearchParam.append("code_verifier", codeVerifier);
  urlSearchParam.append("redirect_uri", authConfig.redirectUri);
  urlSearchParam.append("client_id", authConfig.clientId);

  const body = urlSearchParam.toString();

  return body;
};

export const createRefreshTokenRequestBody = (authConfig: AuthConfig, refreshToken: string) => {
  const urlSearchParam = new URLSearchParams();

  urlSearchParam.append("grant_type", "refresh_token");
  urlSearchParam.append("refresh_token", refreshToken);
  urlSearchParam.append("client_id", authConfig.clientId);
  urlSearchParam.append("scope", authConfig.scope);

  return urlSearchParam.toString();
};

export const createVerifierAndChallengePair = async (actions: Adapters, length: number = 32) => {
  const verifier = await createNonce(length, actions);

  const challenge = base64UrlEncode(sha256(verifier, "ascii"));

  return [verifier, challenge] as const;
};

export const verifyChallenge = (verifier: string, challenge: string) => {
  const challengeHash = base64UrlDecode(challenge);

  const verifierHash = sha256(verifier, "ascii");

  return challengeHash === verifierHash;
};

export const createNonce = async (length: number, actions: Adapters) => {
  const randomASCIIString = await createRandomString(length, actions);

  const nonce = base64UrlEncode(randomASCIIString);

  return nonce;
};

export const createDiscoveryUrl = (issuer: string) => {
  const route = "/.well-known/openid-configuration";

  const issuerWithoutTrailingSlash = trimTrailingSlash(issuer);

  return `${issuerWithoutTrailingSlash}${route}`;
};

export const validateIdToken = (idToken: string, authConfig: AuthConfig, nonce?: string, max_age?: number): boolean => {
  const { header, payload } = decodeJWt(idToken);

  checkEncryption();
  validateIssuer();
  validateAudience();
  validateSignature();
  validateAlg();
  validateMacAlg();
  validateExpClaim();
  validateIatClaim();
  validateNonce();
  validateAcrClaim();
  validateAuthTimeClaim();

  return true;

  function checkEncryption() {
    // not implemented for public clients
  }

  function validateIssuer() {
    if (trimTrailingSlash(authConfig.issuer) !== trimTrailingSlash(payload.iss)) {
      throw new Error(`Invalid issuer, expected ${authConfig.issuer} but got ${payload.iss}`);
    }
  }

  function validateAudience() {
    const audiences = payload.aud.split(" ");

    if (!audiences.includes(authConfig.clientId)) {
      throw new Error(`Invalid audience expected ${authConfig.clientId} but got ${audiences}`);
    }

    if (audiences.length > 1) {
      if (!payload.azp) {
        throw new Error("azp claim is required");
      }

      if (payload.azp !== authConfig.clientId) {
        throw new Error("Invalid azp claim");
      }
    }
  }

  function validateSignature() {
    const { kid, alg } = header;

    if (kid) {
      const jwk = authConfig.jwks?.keys.find((jwk: JWK) => jwk.kid === kid);

      if (!jwk) throw new Error("Invalid kid");

      const pubKey = KEYUTIL.getKey(jwk) as jsrsasign.RSAKey;

      const isValid = KJUR.jws.JWS.verify(idToken, pubKey, [alg]);

      if (!isValid) {
        throw new Error("Invalid signature");
      }
    } else {
      const jwk = authConfig.jwks?.keys.find((jwk: JWK) => jwk.alg === alg);

      if (!jwk) throw new Error("There was no kid, and could not find jwk with matching alg");

      const pubKey = KEYUTIL.getKey(jwk) as jsrsasign.RSAKey;

      const isValid = KJUR.jws.JWS.verify(idToken, pubKey, [alg]);

      if (!isValid) {
        throw new Error("Invalid signature");
      }
    }
  }

  function validateAlg() {
    const { alg } = header;

    if (alg !== "RS256") {
      throw new Error("Invalid algorithm, only RS256 is supported");
    }
  }

  function validateMacAlg() {
    const { alg } = header;

    if (alg === "HS256" || alg === "HS384" || alg === "HS512") {
      throw new Error("Currently MAC algorithms are not supported");
    }
  }

  function validateExpClaim() {
    const skew = authConfig.clockSkewSeconds ?? SKEW_DEFAULT;

    const { exp } = payload;

    if (exp < dateNowMsSinceEpoch() + skew) {
      throw new Error("Token has expired");
    }
  }

  function validateIatClaim() {
    const skew = authConfig.clockSkewSeconds ?? SKEW_DEFAULT;

    const { iat } = payload;

    if (iat > dateNowMsSinceEpoch() + skew) {
      throw new Error("Token is not yet valid");
    }
  }

  function validateNonce() {
    if (!nonce) return;

    if (!payload.nonce) {
      throw new Error("Nonce is required");
    }

    if (!verifyChallenge(nonce, payload.nonce)) {
      throw new Error("Invalid nonce");
    }
  }

  function validateAcrClaim() {
    const { acr } = payload;

    if (!acr) return;
  }

  function validateAuthTimeClaim() {
    const { auth_time } = payload;

    if (!max_age && !auth_time) return;

    if (max_age && !auth_time) throw new Error("auth_time required when max age was requested");

    if (!max_age && auth_time) throw new Error("max_age required when auth_time was returned");

    const timeToExpire = auth_time + max_age;

    if (timeToExpire < dateNowMsSinceEpoch()) {
      throw new Error("Max age was reached");
    }
  }
};

export const createLogoutUrl = (endsessionEndpoint: string, queryParams?: ExtraQueryParams) => {
  if (!queryParams) return endsessionEndpoint;

  const searchParams = new URLSearchParams();

  if (queryParams) {
    typedObjectKeys(queryParams).forEach((key) => {
      searchParams.set(key, queryParams[key]!.toString());
    });
  }

  return `${endsessionEndpoint}?${searchParams.toString()}`;
};

export const validateAtHash = (idToken: string, accessToken: string) => {
  try {
    validateXHash(idToken, (x) => x.payload.at_hash, accessToken);
  } catch (e) {
    throw new Error("Invalid at_hash");
  }
};

export const validateCHash = (idToken: string, code: string) => {
  try {
    validateXHash(idToken, (x) => x.payload.c_hash, code);
  } catch (e) {
    throw new Error("Invalid c_hash");
  }
};

const validateXHash = (idToken: string, getXHash: (jwt: JWT) => string, toValidate: string) => {
  const decodedIdToken = decodeJWt(idToken);

  const x_hash = getXHash(decodedIdToken);

  if (!x_hash) return;

  const hash = sha256(toValidate, "hex");

  const xHash = base64UrlEncode(hash.substring(0, hash.length / 2));

  if (xHash !== x_hash) throw new Error("Invalid");
};

export const authResultToSession = (authResult: AuthResult): Session => {
  const { id_token, access_token, refresh_token, expires_in, scope, token_type } = authResult;

  const { payload } = decodeJWt(id_token);

  return {
    accessToken: access_token,
    idToken: id_token,
    refreshToken: refresh_token,
    expiresIn: expires_in,
    scope,
    tokenType: token_type,
    user: payload,
  };
};

export const createStorageWrapper = (storage: StorageService): StorageWrapper => {
  const get = async (key: StorageKey) => {
    const result = await storage.get(key);

    return result ? JSON.parse(result) : null;
  };

  const set = (key: StorageKey, value: any) => {
    storage.set(key, JSON.stringify(value ?? null));
  };

  const remove = (key: StorageKey) => {
    storage.remove(key);
  };

  const clear = async () => {
    const keys: StorageKey[] = ["discoveryDocument", "jwks"];

    Promise.all(keys.map((key) => remove(key)));
  };

  return {
    get,
    set,
    remove,
    clear,
  };
};

export const createSecureStorageWrapper = <S extends StorageService>(storage?: S): SecureStorageWrapper | null => {
  if (!storage) return null;

  const get = async (key: SecureStorageKey) => {
    const result = await storage.get(key);

    return result ? JSON.parse(result) : null;
  };

  const set = (key: SecureStorageKey, value: any) => {
    storage.set(key, JSON.stringify(value ?? null));
  };

  const remove = (key: SecureStorageKey) => {
    storage.remove(key);
  };

  const clear = async () => {
    const keys: SecureStorageKey[] = ["accessToken", "expiresIn", "idToken", "refreshToken", "scope", "tokenType", "user", "state"];

    Promise.all(keys.map((key) => remove(key)));
  };

  return {
    get,
    set,
    remove,
    clear,
  };
};
