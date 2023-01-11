import { AuthConfig } from "@authts/core";
import { CoreClient } from "../lib/client";

export const Auth0Provider = (config: Auth0Config) => {
  return {
    clientId: config.clientId,
    issuer: config.issuer,
    redirectUri: config.redirectUri,
    postLogoutRedirectUri: config.postLogoutRedirectUri,
    responseType: "code",
    scope: config.scope || "openid profile email",
    preloadDiscoveryDocument: true,
    queryParams: {
      audience: config.audience,
    },
    discovery: {
      end_session_endpoint: `${config.issuer}/v2/logout`,
    },
    autoDiscovery: true,
    provider: "auth0",
  };
};

export type Auth0Config = {
  clientId: string;
  issuer: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  audience: string;
  scope?: string;
};

export const createCoreClientAuth0 = (config: AuthConfig, client: CoreClient) => {
  return {
    ...client,
    signOut: async () => {
      const result = await client.signOut({
        client_id: config.clientId,
        returnTo: config.postLogoutRedirectUri,
      });

      return result;
    },
  };
};
