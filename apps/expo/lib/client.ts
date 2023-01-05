import { createExpoClient } from "@authts/client-expo";

const config = {
  clientId: "my-client-id",
  issuer: "https://my-issuer",
  redirectUri: "my-redirect-uri",
  postLogoutRedirectUri: "my-post-logout-redirect-uri",
  responseType: "code",
  scope: "openid profile email",
  jwks: null,
};

const client = createExpoClient(config, (x) => console.log(x));
