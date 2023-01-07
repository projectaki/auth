import { AuthConfig, createExpoClient } from "@authts/client-expo";
import "react-native-url-polyfill/auto";

const config: AuthConfig = {
  clientId: "zIB73oRSqof13mYtTIud2usuxtLF7MlU",
  issuer: "https://identity-auth.eu.auth0.com",
  redirectUri: "exp://192.168.50.154:19000",
  postLogoutRedirectUri: "exp://192.168.50.154:19000",
  responseType: "code",
  scope: "openid profile email",
  jwks: undefined,
  preloadDiscoveryDocument: true,
  queryParams: {
    audience: "https://identity.com",
  },
  endsessionEndpoint: "https://identity-auth.eu.auth0.com/v2/logout",
};

export const client = createExpoClient(config);
