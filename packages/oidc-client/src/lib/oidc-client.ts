import {
  AuthConfig,
  AuthResult,
  createAuthUrl,
  createIFrame,
  createLogoutUrl,
  createNonce,
  createParamsFromConfig,
  createRefreshTokenRequestBody,
  createSessionCheckPostMessage,
  createTokenRequestBody,
  createVerifierAndChallengePair,
  decodeJWt,
  DiscoveryDocument,
  getQueryParams,
  IdToken,
  isAuthCallback,
  isHttps,
  QueryParams,
  redirectTo,
  replaceUrlState,
  validateAtHash,
  validateCHash,
  validateIdToken,
} from '@z-auth/oidc-utils';
import { EventService } from './events/event-service';
import { DiscoveryService } from './discovery-service';
import { BrowserStorageService } from './storage/browser-storage-service';
import { StorageService } from './storage/storage-service';
import { StorageWrapperService } from './storage/storage-wrapper-service';
import { HttpService } from './http/http-service';
import { FetchHttpService } from './http/fetch-http-service';
import { Logger } from './logger/logger';
import { DefaultLogger } from './logger/default-logger';
import { AuthenticationState } from './events/auth-state';
import { Event } from './events/events';

export class OIDCApi {
  private discoveryDocument?: DiscoveryDocument;
  private checkSessionId?: number;
  private eventService = new EventService();
  private storageService: StorageWrapperService;
  private discoveryService?: DiscoveryService;

  constructor(
    storageService: StorageService = new BrowserStorageService(),
    private authConfig: AuthConfig = {} as AuthConfig,
    private httpService: HttpService = new FetchHttpService(),
    private logger: Logger = new DefaultLogger()
  ) {
    this.storageService = new StorageWrapperService(storageService);
  }

  registerEvents(
    authStateEvent?: (authState: AuthenticationState) => void,
    event?: (event: Event) => void
  ) {
    typeof authStateEvent === 'function' &&
      this.eventService.registerAuthStateHandler(authStateEvent);

    typeof event === 'function' &&
      this.eventService.registerEventHandler(event);
  }

  createAuthUrl(extraParams?: QueryParams) {
    const state = createNonce(42);
    const [nonce, hashedNonce] = createVerifierAndChallengePair(42);
    const [codeVerifier, codeChallenge] = createVerifierAndChallengePair();
    const params = createParamsFromConfig(this.authConfig, extraParams);

    const mergedParams = {
      nonce,
      codeVerifier,
      sendUserBackTo: window.location.href,
      ...params,
    };

    this.storageService.set('state', state);
    this.storageService.set('appState', mergedParams);

    const authUrl = createAuthUrl(
      this.authConfig,
      { ...params, state, nonce: hashedNonce },
      codeChallenge
    );

    return authUrl;
  }

  login = (extraParams?: QueryParams) => {
    const authUrl = this.createAuthUrl(extraParams);

    redirectTo(authUrl);
  };

  localLogout = () => {
    this.removeLocalSession();

    redirectTo(this.authConfig.postLogoutRedirectUri);
  };

  createLogoutUrl = (extraParams?: QueryParams) => {
    const config = this.authConfig;

    if (!config.endsessionEndpoint)
      throw new Error('Endsession endpoint is not set!');

    const params: any = {};

    const idToken = this.storageService.get<AuthResult>('authResult')?.id_token;

    if (idToken) params['id_token_hint'] = idToken;

    // const state = createNonce(42);

    // params.state = state;

    const logoutUrl = createLogoutUrl(config.endsessionEndpoint, {
      ...extraParams,
      ...params,
    });

    return logoutUrl;
  };

  logout = (queryParams?: QueryParams) => {
    const logoutUrl = this.createLogoutUrl(queryParams);

    this.removeLocalSession();

    redirectTo(logoutUrl);
  };

  getAccessToken = () => {
    return this.getAuthResult()?.access_token;
  };

  getIdToken = () => {
    const authResult = this.getAuthResult();

    const token = authResult?.id_token;

    return token ? (this.hasValidIdToken(token) ? token : null) : null;
  };

  getRefreshToken = () => {
    return this.getAuthResult()?.refresh_token;
  };

  initAuth = async (authConfig: AuthConfig): Promise<void> => {
    this.authConfig = authConfig;

    await this.loadDiscoveryIfEnabled();
    this.ensureAllConfigIsLoaded();
    this.tlsCheckIfEnabled();

    try {
      await this.runAuthFlow();
    } catch (e) {
      this.removeLocalSession();
      console.error(e);
      throw e;
    }
  };

  private getAuthResult = () => {
    const authResult = this.storageService.get<AuthResult>('authResult');

    if (!authResult) return null;

    return authResult;
  };

  private getAppState = () => {
    const state = this.storageService.get<string>('state');

    if (!state) return null;

    const appState = this.storageService.get<any>('appState');

    if (!appState) return null;

    return appState;
  };

  private async loadDiscoveryIfEnabled() {
    if (this.authConfig.discovery !== false) {
      this.discoveryService = new DiscoveryService(
        this.authConfig,
        this.storageService,
        this.eventService,
        this.httpService
      );

      this.discoveryDocument =
        await this.discoveryService.loadDiscoveryDocument();

      const newConfig = {
        ...this.authConfig,
        authorizeEndpoint: this.discoveryDocument.authorization_endpoint,
        tokenEndpoint: this.discoveryDocument.token_endpoint,
        jwks: this.discoveryDocument.jwks,
        checkSessionIframe: this.discoveryDocument.check_session_iframe,
      };

      this.authConfig = newConfig;
    }
  }

  private hasValidIdToken = (inputToken?: string): boolean => {
    const cache = this.storageService.getAll();

    if (!cache) return false;

    const token = inputToken ?? cache.authResult?.id_token;

    if (!token) return false;

    const isValid: boolean = validateIdToken(
      token,
      this.authConfig,
      cache.nonce,
      cache.max_age
    );

    return isValid;
  };

  private runAuthFlow = async () => {
    const config = this.authConfig;

    if (isAuthCallback(config)) {
      this.eventService.setAuthState(AuthenticationState.Authenticating);

      const res = await this.processAuthResult();

      validateAtHash(res.id_token, res.access_token);

      this.evaluateAuthState(res.id_token);

      this.storageService.set('authResult', res);
      
      const appState = this.getAppState();

      if (appState.sendUserBackTo && config.preserveRoute !== false)
        replaceUrlState(appState.sendUserBackTo);

      this.eventService.emitEvent('AuthComplete');
    } else {
      this.evaluateAuthState();
    }

    this.startCheckSessionIfPossible();
  };

  /**
   * This will have an effect when we get in here after iframe checksession. If we are in the iframe, we MUST check if the token received is
   * for the same end user, or if we even have received a token at all. If not then we need to remove the local session.
   * @param authResult
   * @returns
   */
  private evaluateAuthResult = (authResult: AuthResult) => {
    try {
      const previdToken =
        this.storageService.get<AuthResult>('authResult')?.id_token;

      if (!authResult.id_token) {
        throw new Error('No id_token found in auth result');
      }

      if (!previdToken) return;

      const payload: IdToken = decodeJWt(authResult.id_token).payload;
      const prevPayload: IdToken = decodeJWt(previdToken).payload;
      console.log(payload, prevPayload);
      if (payload.sub !== prevPayload.sub) {
        throw new Error('Received a different id token for end user');
      }
    } catch (e) {
      this.localLogout();
      throw e;
    }
  };

  private processAuthResult = async (
    queryParams?: URLSearchParams
  ): Promise<AuthResult> => {
    const params = queryParams ?? getQueryParams();

    this.checkState(params);

    if (params.has('error')) throw new Error(<string>params.get('error'));

    try {
      if (this.authConfig.responseType === 'code') {
        const authResult = await this.handleCodeFlowRedirect(params);

        if (
          this.authConfig.disableCheckSession === false &&
          this.authConfig.checkSessionIframe
        )
          this.evaluateAuthResult(authResult);

        const session_state = params.get('session_state');

        if (session_state)
          this.storageService.set('session_state', session_state);

        return authResult;
      } else return {} as AuthResult; // until other cases implemented
    } catch (e) {
      console.error(e);
      throw e;
    }
  };

  private checkState = (params: URLSearchParams) => {
    const returnedState = params.get('state');

    if (!returnedState) throw new Error('State expected from query params!');

    const storedState = this.storageService.get('state');

    if (storedState !== returnedState) throw new Error('Invalid state!');
  };

  private handleCodeFlowRedirect = async (
    params: URLSearchParams
  ): Promise<AuthResult> => {
    if (!params.has('code')) throw new Error('No code found in query params!');

    const code = <string>params.get('code');
    replaceUrlState(this.authConfig.redirectUri);

    try {
      const data = await this.fetchTokensWithCode(code);
      validateCHash(data.id_token, code);

      return data;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  private refreshTokens = async (): Promise<AuthResult> => {
    const newAuthResult = await this.fetchTokensWithRefreshToken();

    validateAtHash(newAuthResult.id_token, newAuthResult.access_token);

    const isValid = this.hasValidIdToken(newAuthResult.id_token);

    if (!isValid) throw new Error('Invalid id token, after refreshing tokens!');

    this.storageService.set('authResult', newAuthResult);

    this.eventService.emitEvent('TokensRefreshed');

    return newAuthResult;
  };

  private fetchTokensWithRefreshToken = async (): Promise<AuthResult> => {
    const refreshToken =
      this.storageService.get<AuthResult>('authResult')?.refresh_token;

    if (!refreshToken) throw new Error('No refresh token found!');

    const requestBody = createRefreshTokenRequestBody(
      this.authConfig,
      refreshToken
    );

    const tokenResponse = await this.httpService.post<AuthResult>(
      this.authConfig.tokenEndpoint!,
      requestBody,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
      }
    );

    return tokenResponse;
  };

  private evaluateAuthState = (token?: string) => {
    const authState = this.hasValidIdToken(token)
      ? AuthenticationState.Authenticated
      : AuthenticationState.Unauthenticated;

    this.eventService.setAuthState(authState);
  };

  private removeLocalSession = () => {
    const state = this.storageService.get<string>('state');

    if (!state) return;

    this.storageService.clear();
    this.eventService.setAuthState(AuthenticationState.Unauthenticated);
  };

  private fetchTokensWithCode = async (code: string): Promise<AuthResult> => {
    const appState = this.getAppState();

    const body = createTokenRequestBody(
      this.authConfig,
      code,
      appState.codeVerifier
    );

    try {
      const tokenResponse = await this.httpService.post<AuthResult>(
        this.authConfig.tokenEndpoint!,
        body,
        {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      );

      return tokenResponse;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  private ensureAllConfigIsLoaded = () => {
    if (!this.authConfig) throw new Error('Missing authConfig');

    if (!this.authConfig.authorizeEndpoint)
      throw new Error(
        'Authorization endpoint is required, if not using discovery!'
      );
    if (!this.authConfig.tokenEndpoint)
      throw new Error('Token endpoint is required, if not using discovery!');

    if (!this.authConfig.jwks) throw new Error('Jwks is required!');
  };

  private tlsCheckIfEnabled = () => {
    if (this.authConfig.useHttps === false) return;

    if (!isHttps(this.authConfig.issuer))
      throw new Error('TLS check failed for issuer!');

    if (!isHttps(this.authConfig.authorizeEndpoint!))
      throw new Error('TLS check failed for authorize endpoint!');

    if (!isHttps(this.authConfig.tokenEndpoint!))
      throw new Error('TLS check failed for token endpoint!');

    if (!isHttps(this.authConfig.endsessionEndpoint!))
      throw new Error('TLS check failed for end session endpoint!');
  };

  private startCheckSessionIfPossible = () => {
    if (
      this.authConfig.checkSessionIframe &&
      !this.authConfig.disableCheckSession
    )
      this.init_check_session();
  };

  private init_check_session = () => {
    const CHECK_SESSION_INTERVAL_SECONDS =
      this.authConfig.checkSessionIframeTimeout ?? 5;

    const iframe = createIFrame(
      'check-session',
      this.authConfig.checkSessionIframe!
    );

    const postMessage = () => {
      const session_state = this.storageService.get<string>('session_state');

      if (!session_state) return;

      const message = createSessionCheckPostMessage(
        this.authConfig.clientId,
        session_state
      );

      iframe.contentWindow?.postMessage(message, this.authConfig.issuer);
    };

    const receiveMessage = (e: MessageEvent) => {
      console.log('Received message', e);
      if (e.origin !== this.authConfig.issuer) {
        return;
      }
      switch (e.data) {
        case 'changed':
          this.checkSessionChanged();
          break;
        case 'unchanged':
          this.checkSessionUnchanged();
          break;
        case 'error':
          this.checkSessionError();
          break;
      }
    };

    this.checkSessionId = setInterval(
      postMessage,
      CHECK_SESSION_INTERVAL_SECONDS * 1000
    );

    window.addEventListener('message', receiveMessage, false);
  };

  private checkSessionChanged = async () => {
    this.eventService.emitEvent('SessionChangedOnServer');
    clearInterval(this.checkSessionId);
  };

  private checkSessionUnchanged = () => {
    this.eventService.emitEvent('SessionUnchangedOnServer');
  };

  private checkSessionError = () => {
    this.eventService.emitEvent('SessionErrorOnServer');
    clearInterval(this.checkSessionId);
  };

  createIframeAndListener() {
    window.addEventListener(
      'message',
      async (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;

        const params = new URLSearchParams(e.data);

        const code = params.get('code');

        const session_state = params.get('session_state');

        if (session_state)
          this.storageService.set('session_state', session_state);

        this.checkState(params);

        const data = await this.fetchTokensWithCode(code!);

        validateCHash(data.id_token, code!);

        validateAtHash(data.id_token, data.access_token);

        const isValid = this.hasValidIdToken(data.id_token);

        if (!isValid)
          throw new Error('Invalid id token, after refreshing tokens!');

        this.storageService.set('authResult', data);

        this.eventService.emitEvent('TokensRefreshed');
      },
      false
    );
    const iframe = document.createElement('iframe');

    iframe.setAttribute('style', 'display: none');

    const extraParams: any = {
      prompt: 'none',
      redirect_uri: 'http://localhost:4200/silent-auth.html',
    };

    if (this.getIdToken()) extraParams['id_token_hint'] = this.getIdToken();

    const url = this.createAuthUrl(extraParams);

    iframe.src = url;

    document.body.appendChild(iframe);
  }
}
