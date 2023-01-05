import {
  AuthConfig,
  StorageService,
  HttpService,
  Logger,
  Actions,
  DiscoveryDocument,
  JWKS,
  AuthenticationState,
  ExtraQueryParams,
  validateIdToken,
  validateAtHash,
  createDiscoveryUrl,
  trimTrailingSlash,
  createNonce,
  createVerifierAndChallengePair,
  createParamsFromConfig,
  createAuthUrl,
  createLogoutUrl,
  Session,
  validateCHash,
  SessionParams,
  createRefreshTokenRequestBody,
  createTokenRequestBody,
} from "@authts/core";

type OidcClientConfig = {
  authConfig: AuthConfig;
  storage: StorageService;
  httpService: HttpService;
  actions: Actions;
  logger?: Logger;
};

export const createCoreClient = ({ authConfig, storage, httpService, actions }: OidcClientConfig) => {
  let discoveryDocument: DiscoveryDocument | null;
  let jwks: JWKS | null;
  let config = authConfig;
  let _authState: AuthenticationState = "unauthenticated";

  const getAuthState = () => {
    return _authState;
  };

  const signIn = async (extraParams?: ExtraQueryParams) => {
    const authUrl = await _createAuthUrlAndSaveState(extraParams);

    actions.redirect(authUrl);
  };

  const signOutLocal = () => {
    _removeLocalSession();

    actions.redirect(config.postLogoutRedirectUri);
  };

  const signOut = async (queryParams?: ExtraQueryParams) => {
    const logoutUrl = await _createLogoutUrlAndSaveState(queryParams);

    _removeLocalSession();

    actions.redirect(logoutUrl);
  };

  const getSession = async () => {
    const appState = await storage.get("appState");

    if (!appState || !appState.session) return null;

    const token = appState.session.id_token;

    if (!token) return null;

    const isValid: boolean = validateIdToken(token, config, appState.nonce, appState.max_age);

    return isValid ? appState.session : null;
  };

  const refreshTokens = async (): Promise<void> => {
    const appState = await storage.get("appState");

    if (!appState) throw new Error("No appState found!");

    const newAuthResult = await _fetchTokensWithRefreshToken(appState);

    validateAtHash(newAuthResult.id_token, newAuthResult.access_token);

    const isValid = validateIdToken(newAuthResult.id_token, config, appState.nonce, appState.max_age);

    if (!isValid) throw new Error("Invalid id token, after refreshing tokens!");

    await storage.set("session", newAuthResult);
  };

  const authCallback = async () => {
    await _loadDiscoveryIfEnabled();

    const appState = await storage.get("appState");

    if (!appState) throw new Error("No appState found");

    _setAuthState("authenticating");

    const res = await _processAuthResult();

    validateAtHash(res.id_token, res.access_token);

    const isValidIdToken = validateIdToken(res.id_token, config, appState.nonce, appState.max_age);

    if (!isValidIdToken) throw new Error("Invalid id token");

    await storage.set("session", res);

    if (appState.sendUserBackTo) actions.replaceUrlState(appState.sendUserBackTo);
  };

  const _setAuthState = (authState: AuthenticationState) => {
    _authState = authState;
    if (typeof actions.authStateChange === "function") actions.authStateChange(authState);
  };

  const _loadDiscoveryDocument = async () => {
    try {
      if (!(await _loadDiscoveryDocumentFromStorage())) await _loadDiscoveryDocumentFromWellKnown();

      if (config.validateDiscovery !== false) _validateDiscoveryDocument();

      if (!(await _loadJwksFromStorage())) await _loadJwks();

      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const _loadDiscoveryDocumentFromWellKnown = async (): Promise<DiscoveryDocument> => {
    const url = createDiscoveryUrl(config.issuer);

    discoveryDocument = await httpService.get<DiscoveryDocument>(url);

    if (!discoveryDocument) throw new Error("Discovery document is required!");

    await storage.set("discoveryDocument", discoveryDocument);

    return discoveryDocument;
  };

  const _loadDiscoveryDocumentFromStorage = async () => {
    discoveryDocument = await storage.get("discoveryDocument");

    return !!discoveryDocument;
  };

  const _validateDiscoveryDocument = () => {
    if (!discoveryDocument) throw new Error("Discovery document is required!");

    const issuerWithoutTrailingSlash = trimTrailingSlash(discoveryDocument.issuer);
    if (issuerWithoutTrailingSlash !== config.issuer) throw new Error("Invalid issuer in discovery document");
  };

  const _loadJwksFromStorage = async () => {
    jwks = await storage.get("jwks");

    return !!jwks;
  };

  const _loadJwks = async () => {
    try {
      jwks = await httpService.get<JWKS>(discoveryDocument!.jwks_uri);

      storage.set("jwks", jwks);

      return !!jwks;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const _createAuthUrlAndSaveState = async (extraParams?: ExtraQueryParams) => {
    const state = await createNonce(32, actions);

    const [nonce, hashedNonce] = await createVerifierAndChallengePair(actions, 32);

    const [codeVerifier, codeChallenge] = await createVerifierAndChallengePair(actions, undefined);

    const params = createParamsFromConfig(config, extraParams);

    const mergedParams = {
      nonce,
      codeVerifier,
      sendUserBackTo: window.location.href,
      state,
      ...params,
    };

    await storage.set("appState", mergedParams);

    const authUrl = createAuthUrl(config, { ...params, state, nonce: hashedNonce }, codeChallenge);

    return authUrl;
  };

  const _createLogoutUrlAndSaveState = async (extraParams?: ExtraQueryParams) => {
    if (!config.endsessionEndpoint) throw new Error("Endsession endpoint is not set!");

    const params: any = {};

    const idToken = (await storage.get("session"))?.id_token;

    if (idToken) params["id_token_hint"] = idToken;

    const logoutUrl = createLogoutUrl(config.endsessionEndpoint, {
      ...extraParams,
      ...params,
    });

    return logoutUrl;
  };

  const _loadDiscoveryIfEnabled = async () => {
    if (config.discovery !== false && !discoveryDocument) {
      await _loadDiscoveryDocument();

      config = {
        ...config,
        authorizeEndpoint: discoveryDocument!.authorization_endpoint,
        tokenEndpoint: discoveryDocument!.token_endpoint,
        jwks: jwks,
      };
    }
  };

  const _processAuthResult = async (): Promise<Session> => {
    const urlString = actions.parseUrl();

    const url = new URL(urlString);

    const params = url.searchParams;

    _checkState(params);

    if (params.has("error")) throw new Error(<string>params.get("error"));

    try {
      const session = await _handleCodeFlowRedirect(params);

      return session;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const _checkState = async (params: URLSearchParams) => {
    const returnedState = params.get("state");

    if (!returnedState) throw new Error("State expected from query params!");

    const storedState = await storage.get("state");

    if (storedState !== returnedState) throw new Error("Invalid state!");
  };

  const _handleCodeFlowRedirect = async (params: URLSearchParams): Promise<Session> => {
    if (!params.has("code")) throw new Error("No code found in query params!");

    const code = <string>params.get("code");

    actions.replaceUrlState(config.redirectUri);

    try {
      const session = await _fetchTokensWithCode(code);

      validateCHash(session.id_token, code);

      return session;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const _fetchTokensWithRefreshToken = async (appState: SessionParams): Promise<Session> => {
    const session = await storage.get("session");

    if (!session) throw new Error("No auth result found!");

    const refreshToken = session.refresh_token;

    if (!refreshToken) throw new Error("No refresh token found!");

    const requestBody = createRefreshTokenRequestBody(config, refreshToken);

    const tokenResponse = await httpService.post<Session>(config.tokenEndpoint!, requestBody, {
      "Content-Type": "application/x-www-form-urlencoded",
    });

    return tokenResponse;
  };

  const _removeLocalSession = async () => {
    const appState = await storage.get("appState");

    if (!appState) throw new Error("No app state found!");

    await storage.clear();
    _setAuthState("unauthenticated");
  };

  const _fetchTokensWithCode = async (code: string): Promise<Session> => {
    const appState = await storage.get("appState");

    if (!appState) throw new Error("No app state found!");

    const body = createTokenRequestBody(config, code, appState.codeVerifier);

    try {
      const tokenResponse = await httpService.post<Session>(config.tokenEndpoint!, body, {
        "Content-Type": "application/x-www-form-urlencoded",
      });

      return tokenResponse;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  if (config.preloadDiscoveryDocument) {
    _loadDiscoveryIfEnabled();
  }

  return {
    authCallback,
    signIn,
    signOut,
    signOutLocal,
    getAuthState,
    refreshTokens,
    getSession,
  };
};
