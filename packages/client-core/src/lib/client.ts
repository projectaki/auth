import {
  AuthConfig,
  Adapters,
  DiscoveryDocument,
  JWKS,
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
  createRefreshTokenRequestBody,
  createTokenRequestBody,
  createStorageWrapper,
  AppStateParams,
  isAuthCb,
  StoredValues,
} from "@authts/core";

type OidcClientConfig = {
  authConfig: AuthConfig;
  adapters: Adapters;
};

export const createCoreClient = ({ authConfig, adapters }: OidcClientConfig) => {
  let _discoveryDocument: DiscoveryDocument | undefined;
  let _jwks: JWKS | undefined;
  let _config = authConfig;
  let _session: Session | null = null;
  let _storage = createStorageWrapper(adapters.storage);
  let _cbUrl: string | undefined;
  let _onAuthStateChange: ((authState: Session | null) => void) | null = () => {};

  const getAuthState = () => {
    return _session;
  };

  /**
   *
   * @param extraParams Query params that will be appended to the auth url
   * @returns Url which the auth has redirected to or void if the redirect doesn't return a url
   */
  const signIn = async (extraParams?: ExtraQueryParams) => {
    const authUrl = await _createAuthUrlAndSaveState(extraParams);

    return await adapters.redirect(authUrl);
  };

  const signOutLocal = () => {
    _removeLocalSession();
  };

  const signOut = async (queryParams?: ExtraQueryParams) => {
    const logoutUrl = await _createLogoutUrlAndSaveState(queryParams);

    await _removeLocalSession();

    if (logoutUrl) await adapters.redirect(logoutUrl);
  };

  const getSession = async () => {
    const appState = await _storage.get("appState");

    if (!appState || !appState.session || !_discoveryDocument || !_jwks) return null;

    const token = appState.session.id_token;

    if (!token) return null;

    const isValid: boolean = validateIdToken(token, _config, appState.nonce, appState.max_age);

    return isValid ? appState.session : null;
  };

  const refreshTokens = async (): Promise<void> => {
    const appState = await _storage.get("appState");

    if (!appState) throw new Error("No appState found!");

    const newAuthResult = await _fetchTokensWithRefreshToken(appState);

    validateAtHash(newAuthResult.id_token, newAuthResult.access_token);

    const isValid = validateIdToken(newAuthResult.id_token, _config, appState.nonce, appState.max_age);

    if (!isValid) throw new Error("Invalid id token, after refreshing tokens!");

    await _storage.set("session", newAuthResult);
  };

  const authCallback = async (url: string) => {
    if (!isAuthCb(url, _config)) return;

    _cbUrl = url;

    try {
      await _loadDiscoveryIfEnabled();

      console.log("authCallback", "discovery loaded");

      const appState = await _storage.get("appState");

      if (!appState) throw new Error("No appState found");

      const res = await _processAuthResult();

      validateAtHash(res.id_token, res.access_token);

      const isValidIdToken = validateIdToken(res.id_token, _config, appState.nonce, appState.max_age);

      if (!isValidIdToken) throw new Error("Invalid id token");

      await _storage.set("session", res);

      if (appState.sendUserBackTo) adapters.replaceUrlState(appState.sendUserBackTo);

      _setAuthState(res);
    } catch (e) {
      console.error(e);
      _setAuthState(null);
    }
  };

  const onAuthStateChange = (callback: (session: Session | null) => void) => {
    _onAuthStateChange = callback;
  };

  const _setAuthState = (session: Session | null) => {
    _session = session;
    if (typeof _onAuthStateChange === "function") _onAuthStateChange(session);
  };

  const _loadDiscoveryDocument = async () => {
    try {
      if (!(await _loadDiscoveryDocumentFromStorage())) await _loadDiscoveryDocumentFromWellKnown();

      if (_config.validateDiscovery !== false) _validateDiscoveryDocument();

      if (!(await _loadJwksFromStorage())) await _loadJwks();

      return true;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const _loadDiscoveryDocumentFromWellKnown = async (): Promise<DiscoveryDocument> => {
    const url = createDiscoveryUrl(_config.issuer);

    _discoveryDocument = await adapters.httpService.get<DiscoveryDocument>(url);

    if (!_discoveryDocument) throw new Error("Discovery document is required!");

    await _storage.set("discoveryDocument", _discoveryDocument);

    return _discoveryDocument;
  };

  const _loadDiscoveryDocumentFromStorage = async () => {
    _discoveryDocument = await _storage.get("discoveryDocument");

    return !!_discoveryDocument;
  };

  const _validateDiscoveryDocument = () => {
    if (!_discoveryDocument) throw new Error("Discovery document is required!");

    const issuerWithoutTrailingSlash = trimTrailingSlash(_discoveryDocument.issuer);
    if (issuerWithoutTrailingSlash !== _config.issuer) throw new Error("Invalid issuer in discovery document");
  };

  const _loadJwksFromStorage = async () => {
    _jwks = await _storage.get("jwks");

    return !!_jwks;
  };

  const _loadJwks = async () => {
    try {
      _jwks = await adapters.httpService.get<JWKS>(_discoveryDocument!.jwks_uri);

      await _storage.set("jwks", _jwks);

      return !!_jwks;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const _createAuthUrlAndSaveState = async (extraParams?: ExtraQueryParams) => {
    const state = await createNonce(32, adapters);

    const [nonce, hashedNonce] = await createVerifierAndChallengePair(adapters, 32);

    const [codeVerifier, codeChallenge] = await createVerifierAndChallengePair(adapters, undefined);

    const params = createParamsFromConfig(_config, extraParams);

    const currentUrl = await adapters.parseUrl();

    const mergedParams: AppStateParams = {
      nonce,
      codeVerifier,
      sendUserBackTo: currentUrl,
      state,
      ...params,
    };

    await _storage.set("appState", mergedParams);

    const authUrl = createAuthUrl(_config, { ...params, state, nonce: hashedNonce, code_challenge: codeChallenge });

    return authUrl;
  };

  const _createLogoutUrlAndSaveState = async (extraParams?: ExtraQueryParams) => {
    if (!_config.endsessionEndpoint) {
      console.log("No endsession endpoint found, cannot log out at idp");
      return null;
    }

    const params: any = {};

    const idToken = (await _storage.get("session"))?.id_token;

    if (idToken) params["id_token_hint"] = idToken;

    const logoutUrl = createLogoutUrl(_config.endsessionEndpoint, {
      ...extraParams,
      ...params,
    });

    return logoutUrl;
  };

  const _loadDiscoveryIfEnabled = async () => {
    if (_config.discovery !== false && !_discoveryDocument) {
      await _loadDiscoveryDocument();
    }

    _config = {
      ..._config,
      authorizeEndpoint: _discoveryDocument!.authorization_endpoint,
      tokenEndpoint: _discoveryDocument!.token_endpoint,
      jwks: _jwks,
    };
  };

  const _processAuthResult = async (): Promise<Session> => {
    const urlString = _cbUrl!;

    const [_, search] = urlString.split("?");

    const params = new URLSearchParams(search);

    await _checkState(params);

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

    const storedState = await _storage.get("state");

    if (storedState !== returnedState) throw new Error("Invalid state!");
  };

  const _handleCodeFlowRedirect = async (params: URLSearchParams): Promise<Session> => {
    if (!params.has("code")) throw new Error("No code found in query params!");

    const code = <string>params.get("code");

    await adapters.replaceUrlState(_config.redirectUri);

    try {
      const session = await _fetchTokensWithCode(code);

      validateCHash(session.id_token, code);

      return session;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const _fetchTokensWithRefreshToken = async (appState: StoredValues): Promise<Session> => {
    const session = await _storage.get("session");

    if (!session) throw new Error("No auth result found!");

    const refreshToken = session.refresh_token;

    if (!refreshToken) throw new Error("No refresh token found!");

    const requestBody = createRefreshTokenRequestBody(_config, refreshToken);

    const tokenResponse = await adapters.httpService.post<Session>(_config.tokenEndpoint!, requestBody, {
      "Content-Type": "application/x-www-form-urlencoded",
    });

    return tokenResponse;
  };

  const _removeLocalSession = async () => {
    const appState = await _storage.get("appState");

    if (!appState) throw new Error("No app state found!");

    await _storage.remove("appState");

    _setAuthState(null);
  };

  const _initSessionIfExists = async () => {
    const appState = await _storage.get("appState");

    _jwks = appState?.jwks;
    _discoveryDocument = appState?.discoveryDocument;

    if (!appState || !appState.session || !_discoveryDocument || !_jwks) return;

    const token = appState.session.id_token;

    if (!token) return;

    const isValid: boolean = validateIdToken(token, _config, appState.nonce, appState.max_age);

    if (!isValid) return;

    _session = appState.session;

    _setAuthState(appState.session);
  };

  const _fetchTokensWithCode = async (code: string): Promise<Session> => {
    const appState = await _storage.get("appState");

    if (!appState) throw new Error("No app state found!");

    const body = createTokenRequestBody(_config, code, appState.codeVerifier);

    try {
      const tokenResponse = await adapters.httpService.post<Session>(_config.tokenEndpoint!, body, {
        "Content-Type": "application/x-www-form-urlencoded",
      });

      return tokenResponse;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  if (_config.preloadDiscoveryDocument) {
    _loadDiscoveryIfEnabled().then(() => {
      _initSessionIfExists();
    });
  } else {
    _initSessionIfExists();
  }

  return {
    authCallback,
    signIn,
    signOut,
    signOutLocal,
    getAuthState,
    refreshTokens,
    getSession,
    onAuthStateChange,
  };
};
