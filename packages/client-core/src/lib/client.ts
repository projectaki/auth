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
  AuthState,
  createSecureStorageWrapper,
  SecureStorageWrapper,
  AuthResult,
  typedObjectKeys,
  authResultToSession,
} from "@authts/core";

type OidcClientConfig = {
  authConfig: AuthConfig;
  adapters: Adapters;
};

export const createCoreClient = ({ authConfig, adapters }: OidcClientConfig) => {
  const _config = { ...authConfig };
  let _storage = createStorageWrapper(adapters.storage);
  let _secureStorage: SecureStorageWrapper = createSecureStorageWrapper(adapters.secureStorage) ?? _storage;
  let _configsLoaded = authConfig.autoDiscovery ? false : true;
  let _onAuthStateChange: (session: Session | null) => void = () => {};

  /**
   *
   * @param extraParams Query params that will be appended to the auth url
   * @returns Url which the auth has redirected to or void if the redirect doesn't return a url
   */
  const signIn = async (extraParams?: ExtraQueryParams) => {
    const authUrl = await _createAuthUrlAndSaveState(extraParams);

    return await adapters.redirect(authUrl);
  };

  /**
   * Removes the session from the configured storage and triggers and auth state change to null.
   */
  const signOutLocal = () => {
    return _endSession();
  };

  /**
   * Internally calls the signOutLocal method and then redirects to the configured logout url if it exists.
   * @param queryParams Extra query params that will be appended to the logout url
   * @returns Void or the redirected url.
   */
  const signOut = async (queryParams?: ExtraQueryParams) => {
    const logoutUrl = await _createLogoutUrlAndSaveState(queryParams);

    await signOutLocal();

    if (logoutUrl) return await adapters.redirect(logoutUrl);
  };

  /**
   * Gets the session from the configured storage.
   * Will throw an error if the session exists, but the id token is invalid.
   * @returns The session it exists and is valid and if the configs are loaded, otherwise null.
   */
  const getSession = async () => {
    const state = await _secureStorage.get("state");
    const session = await _getSession();

    if (!state || !session || !_configsLoaded) return null;

    const { max_age, nonce } = state;

    const { idToken } = session;

    const isValid: boolean = validateIdToken(idToken, _config, nonce, max_age);

    if (!isValid) throw new Error("Session exists, but the id token is invalid!");

    return session;
  };

  const refreshTokens = async (): Promise<void> => {
    const state = await _secureStorage.get("state");

    if (!state) throw new Error("No appState found!");

    const { max_age, nonce } = state;

    const session = await _fetchTokensWithRefreshToken(state);

    const { idToken, accessToken } = session;

    validateAtHash(idToken, accessToken);

    const isValid = validateIdToken(idToken, _config, nonce, max_age);

    if (!isValid) throw new Error("Invalid id token, after refreshing tokens!");

    await _setSession(session);
  };

  /**
   * The auth callback method that should be called when the auth callback has redirected to the configured redirect url. This
   * will internally fetch the discovery if it has not already set, either by preloading it or by manually setting it in the config.
   * It will process the auth result, exchange the code for tokens and validate the id token, store the session in the
   * configured storage and triggers an auth state change. If
   * the `replaceUrlState` adapter is set, it will replace the url state with the url that initiated the login flow.
   * @param url The url that the auth callback has redirected to containing the code.
   */
  const authCallback = async (url: string) => {
    try {
      await _fetchDiscovery();

      const state = await _secureStorage.get("state");

      if (!state) throw new Error("No appState found");

      const { max_age, nonce, sendUserBackTo } = state;

      const authResult = await _processCb(url);

      const { id_token, access_token } = authResult;

      validateAtHash(id_token, access_token);

      const isValidIdToken = validateIdToken(id_token, _config, nonce, max_age);

      if (!isValidIdToken) throw new Error("Invalid id token");

      const session = authResultToSession(authResult);

      await _setSession(session);

      if (sendUserBackTo) adapters.replaceUrlState(sendUserBackTo);

      _setAuthState(session);
    } catch (e) {
      console.error(e);
      _setAuthState(null);
    }
  };

  /**
   *
   * @param callback The callback that will be called when the auth state changes.
   */
  const onAuthStateChange = (callback: (session: Session | null) => void) => {
    _onAuthStateChange = callback;
  };

  const _getSession = async () => {
    const keys: (keyof Session)[] = ["idToken", "accessToken", "refreshToken", "expiresIn", "scope", "tokenType", "user"];

    const vals = await Promise.all(
      keys.map(async (key) => {
        const val = await _secureStorage.get(key);

        return [key, val] as const;
      }),
    );

    if (!vals[0] || !vals[0][1]) return null;

    const session: Session = vals.reduce((acc, [key, val]) => {
      if (val) acc[key] = val;

      return acc;
    }, {} as any);

    return session;
  };

  const _setSession = async (session: Session) => {
    return await Promise.all(
      typedObjectKeys(session).map(async (key) => {
        await _secureStorage.set(key, session[key]);
      }),
    );
  };

  const _setAuthState = (session: Session | null) => {
    if (typeof _onAuthStateChange === "function") _onAuthStateChange(session);
  };

  const _fetchDiscovery = async () => {
    if (_config.autoDiscovery !== false) {
      const discovery = (await _storage.get("discoveryDocument")) ?? (await _loadDiscoveryDocumentFromWellKnown());

      _config.discovery = { ..._config.discovery, ...discovery };
    }

    if (!_config.jwks && _config.autoDiscovery !== false) {
      _config.jwks = (await _storage.get("jwks")) ?? (await _loadJwks());
    }

    _configsLoaded = true;
  };

  const _loadDiscoveryDocumentFromWellKnown = async () => {
    const url = createDiscoveryUrl(_config.issuer);

    const discoveryDocument = await adapters.httpService.get<DiscoveryDocument>(url);

    if (!discoveryDocument) throw new Error("Discovery couldn't be loaded from well known!");

    const issuerWithoutTrailingSlash = trimTrailingSlash(discoveryDocument.issuer);

    if (issuerWithoutTrailingSlash !== _config.issuer) throw new Error("Invalid issuer in discovery document");

    await _storage.set("discoveryDocument", discoveryDocument);

    return discoveryDocument;
  };

  const _loadJwks = async () => {
    if (!_config.discovery.jwks_uri) throw new Error("Jwks uri is missing!");
    try {
      const jwks = await adapters.httpService.get<JWKS>(_config.discovery.jwks_uri);

      await _storage.set("jwks", jwks);

      return jwks;
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

    const mergedParams: AuthState = {
      nonce,
      codeVerifier,
      sendUserBackTo: currentUrl,
      state,
      ...params,
    };

    await _secureStorage.set("state", mergedParams);

    const authUrl = createAuthUrl(_config, { ...params, state, nonce: hashedNonce, code_challenge: codeChallenge });

    return authUrl;
  };

  const _createLogoutUrlAndSaveState = async (extraParams?: ExtraQueryParams) => {
    if (!_config.discovery?.end_session_endpoint) {
      console.log("No endsession endpoint found, cannot log out at idp");
      return null;
    }

    const params: any = {};

    const session = await _getSession();

    const idToken = session?.idToken;

    if (idToken) params["id_token_hint"] = idToken;

    const logoutUrl = createLogoutUrl(_config.discovery.end_session_endpoint, {
      ...extraParams,
      ...params,
    });

    return logoutUrl;
  };

  const _processCb = async (url: string): Promise<AuthResult> => {
    const [_, search] = url.split("?");

    const params = new URLSearchParams(search);

    await _checkState(params);

    if (params.has("error")) throw new Error(<string>params.get("error"));

    try {
      const authResult = await _handleCodeFlowRedirect(params);

      return authResult;
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  const _checkState = async (params: URLSearchParams) => {
    const returnedState = params.get("state");
    const authState = await _secureStorage.get("state");

    if (!returnedState) throw new Error("State expected from query params!");

    const storedState = authState?.state;

    if (storedState !== returnedState) throw new Error("Invalid state!");
  };

  const _handleCodeFlowRedirect = async (params: URLSearchParams): Promise<AuthResult> => {
    if (!params.has("code")) throw new Error("No code found in query params!");

    const code = <string>params.get("code");

    await adapters.replaceUrlState(_config.redirectUri);

    try {
      const authResult = await _fetchTokensWithCode(code);

      validateCHash(authResult.id_token, code);

      return authResult;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const _fetchTokensWithRefreshToken = async (appState: AuthState): Promise<Session> => {
    const session = await _getSession();

    if (!session) throw new Error("No auth result found!");

    const { refreshToken } = session;

    if (!refreshToken) throw new Error("No refresh token found!");

    const requestBody = createRefreshTokenRequestBody(_config, refreshToken);

    const tokenResponse = await adapters.httpService.post<Session>(_config.discovery?.token_endpoint!, requestBody, {
      "Content-Type": "application/x-www-form-urlencoded",
    });

    return tokenResponse;
  };

  const _endSession = async () => {
    try {
      await _secureStorage.clear();
      await _storage.clear();
    } catch {}

    _setAuthState(null);
  };

  const _initSessionIfExists = async () => {
    const session = await getSession();

    _setAuthState(session);
  };

  const _fetchTokensWithCode = async (code: string): Promise<AuthResult> => {
    const state = await _secureStorage.get("state");

    if (!state) throw new Error("No app state found!");

    const body = createTokenRequestBody(_config, code, state.codeVerifier);

    try {
      const tokenResponse = await adapters.httpService.post<AuthResult>(_config.discovery?.token_endpoint!, body, {
        "Content-Type": "application/x-www-form-urlencoded",
      });

      return tokenResponse;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  if (_config.preloadDiscoveryDocument) {
    _fetchDiscovery().then(() => {
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
    refreshTokens,
    getSession,
    onAuthStateChange,
  };
};
