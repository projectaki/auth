import { createEventService } from "./events/event-service";
import { createStorageWrapper } from "./storage/storage-wrapper-service";
import { HttpService } from "./http/http-service";

import { Logger } from "./logger/logger";
import { createDefaultLogger } from "./logger/default-logger";
import {
  AuthResult,
  createAuthUrl,
  createDiscoveryUrl,
  createLogoutUrl,
  createNonce,
  createParamsFromConfig,
  createRefreshTokenRequestBody,
  createTokenRequestBody,
  createVerifierAndChallengePair,
  DiscoveryDocument,
  getQueryParams,
  JWKS,
  QueryParams,
  replaceUrlState,
  trimTrailingSlash,
  validateAtHash,
  validateCHash,
  validateIdToken,
  AuthConfig,
} from "@auth/oidc-utils";
import { StorageService } from "./storage/storage-service";

type OidcClientConfig = {
  authConfig: AuthConfig;
  storage: StorageService;
  httpService: HttpService;
  logger: Logger;
};

const createOidcClient = ({
  authConfig,
  storage,
  httpService,
  logger = createDefaultLogger(),
}: OidcClientConfig) => {
  let discoveryDocument: DiscoveryDocument | null;
  let jwks: JWKS | null;
  let config = authConfig;

  const eventService = createEventService(config.authStateChange);
  const _storage = createStorageWrapper(storage);

  const loadDiscoveryDocument = async () => {
    try {
      (await loadDiscoveryDocumentFromStorage()) ??
        (await loadDiscoveryDocumentFromWellKnown());

      (await loadJwksFromStorage()) ?? (await loadJwks());

      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const loadDiscoveryDocumentFromWellKnown =
    async (): Promise<DiscoveryDocument> => {
      const url = createDiscoveryUrl(config.issuer);

      discoveryDocument = await httpService.get<DiscoveryDocument>(url);

      if (!discoveryDocument)
        throw new Error("Discovery document is required!");

      if (config.validateDiscovery !== false) validateDiscoveryDocument();

      await _storage.set("discoveryDocument", discoveryDocument);

      return discoveryDocument;
    };

  const loadDiscoveryDocumentFromStorage = async () => {
    discoveryDocument = await _storage.get("discoveryDocument");

    if (discoveryDocument && config.validateDiscovery !== false)
      validateDiscoveryDocument();

    return !!discoveryDocument;
  };

  const validateDiscoveryDocument = () => {
    if (!discoveryDocument) throw new Error("Discovery document is required!");

    const issuerWithoutTrailingSlash = trimTrailingSlash(
      discoveryDocument.issuer,
    );
    if (issuerWithoutTrailingSlash !== config.issuer)
      throw new Error("Invalid issuer in discovery document");
  };

  const loadJwksFromStorage = async () => {
    jwks = await _storage.get("jwks");

    return !!jwks;
  };

  const loadJwks = async () => {
    try {
      jwks = await httpService.get<JWKS>(discoveryDocument!.jwks_uri);

      _storage.set("jwks", jwks);

      return !!jwks;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const createAuthUrlAndSaveState = async (extraParams?: QueryParams) => {
    const state = await createNonce(42, config);

    const [nonce, hashedNonce] = await createVerifierAndChallengePair(
      42,
      config,
    );

    const [codeVerifier, codeChallenge] = await createVerifierAndChallengePair(
      undefined,
      config,
    );

    const params = createParamsFromConfig(config, extraParams);

    const mergedParams = {
      nonce,
      codeVerifier,
      sendUserBackTo: window.location.href,
      ...params,
    };

    // TODO
    _storage.set("state", state);
    _storage.set("appState", mergedParams);

    const authUrl = createAuthUrl(
      config,
      { ...params, state, nonce: hashedNonce },
      codeChallenge,
    );

    return authUrl;
  };

  const login = async (extraParams?: QueryParams) => {
    const authUrl = await createAuthUrlAndSaveState(extraParams);

    config.redirect(authUrl);
  };

  const localLogout = () => {
    removeLocalSession();

    config.redirect(config.postLogoutRedirectUri);
  };

  const createLogoutUrlX = async (extraParams?: QueryParams) => {
    if (!config.endsessionEndpoint)
      throw new Error("Endsession endpoint is not set!");

    const params: any = {};

    const idToken = (await _storage.get("authResult"))?.id_token;

    if (idToken) params["id_token_hint"] = idToken;

    const logoutUrl = createLogoutUrl(config.endsessionEndpoint, {
      ...extraParams,
      ...params,
    });

    return logoutUrl;
  };

  const logout = async (queryParams?: QueryParams) => {
    const logoutUrl = await createLogoutUrlX(queryParams);

    removeLocalSession();

    config.redirect(logoutUrl);
  };

  const getAccessToken = async () => {
    return (await getAuthResult())?.access_token;
  };

  const getIdToken = async () => {
    const authResult = await getAuthResult();

    const token = authResult?.id_token;

    return token ? ((await hasValidIdToken(token)) ? token : null) : null;
  };

  const getRefreshToken = async () => {
    return (await getAuthResult())?.refresh_token;
  };

  const initAuth = async (config: config): Promise<void> => {
    config = config;

    await loadDiscoveryIfEnabled();

    try {
      await runAuthFlow();
    } catch (e) {
      removeLocalSession();
      console.error(e);
      throw e;
    }
  };

  const getAuthResult = async () => {
    const authResult = await _storage.get("authResult");

    if (!authResult) return null;

    return authResult;
  };

  const getAppState = async () => {
    const state = await _storage.get("state");

    if (!state) return null;

    const appState = await _storage.get("appState");

    if (!appState) return null;

    return appState;
  };

  const loadDiscoveryIfEnabled = async () => {
    if (config.discovery !== false) {
      await loadDiscoveryDocument();

      config = {
        ...config,
        authorizeEndpoint: discoveryDocument!.authorization_endpoint,
        tokenEndpoint: discoveryDocument!.token_endpoint,
        jwks: jwks,
        checkSessionIframe: discoveryDocument!.check_session_iframe,
      };
    }
  };

  const hasValidIdToken = async (inputToken?: string) => {
    const cache = await _storage.getAll();

    if (!cache) return false;

    const token = inputToken ?? cache.authResult?.id_token;

    if (!token) return false;

    const isValid: boolean = validateIdToken(
      token,
      config,
      cache.nonce,
      cache.max_age,
    );

    return isValid;
  };

  const authCallback = async () => {
    eventService.setAuthState("authenticating");

    const res = await processAuthResult();

    validateAtHash(res.id_token, res.access_token);

    evaluateAuthState(res.id_token);

    await _storage.set("authResult", res);

    const appState = await getAppState();

    if (appState.sendUserBackTo && config.preserveRoute !== false)
      replaceUrlState(appState.sendUserBackTo);
  };

  /**
   * This will have an effect when we get in here after iframe checksession. If we are in the iframe, we MUST check if the token received is
   * for the same end user, or if we even have received a token at all. If not then we need to remove the local session.
   * @param authResult
   * @returns
   */
  // private evaluateAuthResult = (authResult: AuthResult) => {
  //   try {
  //     const previdToken =
  //       _storage.get<AuthResult>("authResult")?.id_token;

  //     if (!authResult.id_token) {
  //       throw new Error("No id_token found in auth result");
  //     }

  //     if (!previdToken) return;

  //     const payload: IdToken = decodeJWt(authResult.id_token).payload;
  //     const prevPayload: IdToken = decodeJWt(previdToken).payload;
  //     console.log(payload, prevPayload);
  //     if (payload.sub !== prevPayload.sub) {
  //       throw new Error("Received a different id token for end user");
  //     }
  //   } catch (e) {
  //     localLogout();
  //     throw e;
  //   }
  // };

  const processAuthResult = async (
    queryParams?: URLSearchParams,
  ): Promise<AuthResult> => {
    const params = queryParams ?? getQueryParams();

    checkState(params);

    if (params.has("error")) throw new Error(<string>params.get("error"));

    try {
      if (config.responseType === "code") {
        const authResult = await handleCodeFlowRedirect(params);

        //if (config.disableCheckSession === false && config.checkSessionIframe)
        //evaluateAuthResult(authResult);

        // const session_state = params.get("session_state");

        // if (session_state)
        //   _storage.set("session_state", session_state);

        return authResult;
      } else return {} as AuthResult; // until other cases implemented
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const checkState = async (params: URLSearchParams) => {
    const returnedState = params.get("state");

    if (!returnedState) throw new Error("State expected from query params!");

    const storedState = await _storage.get("state");

    if (storedState !== returnedState) throw new Error("Invalid state!");
  };

  const handleCodeFlowRedirect = async (
    params: URLSearchParams,
  ): Promise<AuthResult> => {
    if (!params.has("code")) throw new Error("No code found in query params!");

    const code = <string>params.get("code");
    replaceUrlState(config.redirectUri);

    try {
      const data = await fetchTokensWithCode(code);
      validateCHash(data.id_token, code);

      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const refreshTokens = async (): Promise<AuthResult> => {
    const newAuthResult = await fetchTokensWithRefreshToken();

    validateAtHash(newAuthResult.id_token, newAuthResult.access_token);

    const isValid = await hasValidIdToken(newAuthResult.id_token);

    if (!isValid) throw new Error("Invalid id token, after refreshing tokens!");

    await _storage.set("authResult", newAuthResult);

    return newAuthResult;
  };

  const fetchTokensWithRefreshToken = async (): Promise<AuthResult> => {
    const refreshToken = (await _storage.get("authResult"))?.refresh_token;

    if (!refreshToken) throw new Error("No refresh token found!");

    const requestBody = createRefreshTokenRequestBody(config, refreshToken);

    const tokenResponse = await httpService.post<AuthResult>(
      config.tokenEndpoint!,
      requestBody,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    );

    return tokenResponse;
  };

  const evaluateAuthState = async (token?: string) => {
    const authState = (await hasValidIdToken(token))
      ? "authenticated"
      : "unauthenticated";

    eventService.setAuthState(authState);
  };

  const removeLocalSession = async () => {
    const state = await _storage.get("state");

    if (!state) return;

    await _storage.clear();
    eventService.setAuthState("unauthenticated");
  };

  const fetchTokensWithCode = async (code: string): Promise<AuthResult> => {
    const appState = getAppState();

    const body = createTokenRequestBody(config, code, appState.codeVerifier);

    try {
      const tokenResponse = await httpService.post<AuthResult>(
        config.tokenEndpoint!,
        body,
        {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      );

      return tokenResponse;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };
};
