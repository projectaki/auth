export type AuthConfig = {
  responseType: "code";
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  issuer: string;
  scope: string;
  authorizeEndpoint?: string;
  tokenEndpoint?: string;
  endsessionEndpoint?: string;
  jwks: JWKS | null;
  queryParams?: QueryParams;
  validateDiscovery?: boolean;
  discovery?: boolean;
  clockSkewSeconds?: number;
  enforceHttps?: boolean;
  disableRefreshTokenConsent?: boolean;
  preloadDiscoveryDocument?: boolean;
};

export type Actions = {
  redirect: (url: string) => void;
  parseUrl: () => string;
  replaceUrlState: (url: string) => void;
  randomBytes: (size: number) => Promise<Uint8Array> | Uint8Array;
  authStateChange: (authState: string) => void;
};

export type AuthBaseParams = {
  response_type: "code";
  client_id: string;
  redirect_uri: string;
  scope: string;
  state?: string;
  response_mode?: "query" | "fragment";
  nonce?: string;
  display?: "page" | "popup" | "touch" | "wap";
  prompt?: "none" | "consent" | "login" | "select_account";
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
};

export type ExtraQueryParams = Record<"audience", string>;

type StateParams = {
  session: Session;
  nonce: string;
  codeVerifier: string;
  sendUserBackTo: string;
  discoveryDocument: DiscoveryDocument;
  jwks: JWKS;
};

export type QueryParams = Record<string, number | string | boolean>;

export type SessionParams = AuthBaseParams & StateParams & ExtraQueryParams;

export type SessionParamKeys = keyof SessionParams;

export type AuthErrorParams = {
  error: AuthError;
  error_description?: string;
  error_uri?: string;
  state?: string;
};

type AuthError =
  | "access_denied"
  | "unauthorized_client"
  | "interaction_required"
  | "invalid_request"
  | "invalid_request_uri"
  | "invalid_request_object"
  | "login_required"
  | "unsupported_response_type"
  | "server_error"
  | "temporarily_unavailable"
  | "user_cancelled"
  | "invalid_client"
  | "invalid_grant"
  | "invalid_scope"
  | "user_selection_required"
  | "consent_required"
  | "request_not_supported"
  | "request_uri_not_supported"
  | "registration_not_supported";

export type DiscoveryDocument = {
  check_session_iframe: string;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

type IdTokenBase = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  auth_time?: number;
  nonce?: string;
  acr?: string;
  amr?: string;
  azp?: string;
};

export type IdToken = IdTokenBase & QueryParams;

export type Session = {
  access_token: string;
  id_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  user: any;
};

export type JWKS = {
  keys: JWK[];
};

export type JWK = {
  alg: string;
  kty: string;
  use: string;
  n: string;
  e: string;
  kid: string;
  x5t: string;
  x5c: string[];
};

export type JWT = {
  header: any;
  payload: any;
  signature: string;
};

export type StorageService = {
  get<K extends StorageKey>(
    key: K,
  ): StorageReturnType<K> | null | Promise<StorageReturnType<K> | null>;
  set<K extends StorageKey, T>(key: K, value: T): void | Promise<void>;
  remove<K extends StorageKey>(key: K): void | Promise<void>;
  clear(): void | Promise<void>;
};

type StorageReturnType<K> = K extends "appState"
  ? SessionParams
  : K extends SessionParamKeys
  ? SessionParams[K]
  : never;

type StorageKey = SessionParamKeys | "appState";

export type Logger = {
  log(message: string, ...optionalParams: any[]): void;
  error(message: string, ...optionalParams: any[]): void;
  warn(message: string, ...optionalParams: any[]): void;
};

export type HttpService = {
  get<T>(url: string, headers?: { [key: string]: string }): Promise<T>;

  post<T>(
    url: string,
    body: any,
    headers?: { [key: string]: string },
  ): Promise<T>;
};

export type AuthenticationState =
  | "unauthenticated"
  | "authenticating"
  | "authenticated";
