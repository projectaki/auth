export type MaybePromise<T> = T | Promise<T>;

export type InferReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

export type AuthConfig =
  | {
      responseType: "code";
      clientId: string;
      redirectUri: string;
      postLogoutRedirectUri: string;
      issuer: string;
      scope: string;
      discovery: DiscoveryDocument;
      jwks: JWKS;
      queryParams?: ExtraQueryParams;
      validateDiscovery?: boolean;
      clockSkewSeconds?: number;
      enforceHttps?: boolean;
      disableRefreshTokenConsent?: boolean;
      preloadDiscoveryDocument?: boolean;
      autoDiscovery: false;
    }
  | {
      responseType: "code";
      clientId: string;
      redirectUri: string;
      postLogoutRedirectUri: string;
      issuer: string;
      scope: string;
      discovery: Partial<DiscoveryDocument>;
      jwks?: JWKS;
      queryParams?: ExtraQueryParams;
      validateDiscovery?: boolean;
      clockSkewSeconds?: number;
      enforceHttps?: boolean;
      disableRefreshTokenConsent?: boolean;
      preloadDiscoveryDocument?: boolean;
      autoDiscovery?: true;
    };

export type DiscoveryDocument = {
  check_session_iframe?: string;
  end_session_endpoint?: string;
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};

export type Adapters = {
  redirect: (url: string) => MaybePromise<string | undefined | void>;
  parseUrl: () => MaybePromise<string>;
  replaceUrlState: (url: string) => MaybePromise<void>;
  randomBytes: (size: number) => MaybePromise<Uint8Array>;
  storage: StorageService;
  httpService: HttpService;
  logger?: Logger;
};

export type AuthBaseParams = {
  response_type: "code";
  client_id: string;
  redirect_uri: string;
  scope: string;
};

export type AppStateParams = AuthBaseParams & {
  nonce: string;
  codeVerifier: string;
  sendUserBackTo: string;
  state: string;
};

export type AuthParams = AuthBaseParams & ExtraQueryParams;

export type ExtraQueryParams = {
  audience?: string;
  code_challenge?: string;
  code_challenge_method?: "S256";
  code_verifier?: string;
  nonce?: string;
  state?: string;
  response_mode?: "query" | "fragment";
  display?: "page" | "popup" | "touch" | "wap";
  prompt?: "none" | "consent" | "login" | "select_account";
  max_age?: number;
  ui_locales?: string;
  id_token_hint?: string;
  login_hint?: string;
  acr_values?: string;
  returnTo?: string;
  client_id?: string;
};

type OAuthResult = {
  session?: Session;
  discoveryDocument?: DiscoveryDocument;
  jwks?: JWKS;
};

export type StoredValues = AppStateParams & OAuthResult & ExtraQueryParams;

export type StoredValuesKeys = keyof StoredValues;

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

export type IdToken = IdTokenBase;

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
  get(key: string): MaybePromise<string | null>;
  set(key: string, value: string): MaybePromise<void>;
  remove(key: string): MaybePromise<void>;
};

export type StorageWrapper = {
  get<K extends StorageKey>(key: K): MaybePromise<StorageReturnType<K> | null>;
  set<K extends StorageKey>(key: K, value: StorageReturnType<K>): MaybePromise<void>;
  remove(key: StorageKey): MaybePromise<void>;
};

export type StorageReturnType<K> = K extends "appState" ? StoredValues : K extends StoredValuesKeys ? StoredValues[K] : never;

export type StorageKey = StoredValuesKeys | "appState";

export type Logger = {
  log(message: string, ...optionalParams: any[]): void;
  error(message: string, ...optionalParams: any[]): void;
  warn(message: string, ...optionalParams: any[]): void;
};

export type HttpService = {
  get<T>(url: string, headers?: { [key: string]: string }): Promise<T>;

  post<T>(url: string, body: any, headers?: { [key: string]: string }): Promise<T>;
};

export type AuthenticationState = "unauthenticated" | "authenticating" | "authenticated";
