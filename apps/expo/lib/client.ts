import { createExpoClient } from "@authts/client-expo";
import "react-native-url-polyfill/auto";

export const client = createExpoClient({
  clientId: "zIB73oRSqof13mYtTIud2usuxtLF7MlU",
  issuer: "https://identity-auth.eu.auth0.com",
  redirectUri: "exp://192.168.50.154:19000",
  postLogoutRedirectUri: "exp://192.168.50.154:19000",
  responseType: "code",
  scope: "openid profile email",
  preloadDiscoveryDocument: true,
  queryParams: {
    audience: "https://identity.com",
  },
  discovery: {
    end_session_endpoint: "https://identity-auth.eu.auth0.com/v2/logout",
  },
  autoDiscovery: true,
});
