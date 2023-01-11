import { AuthConfig, AuthConfigWithProvider } from "@authts/core";
import { createCoreClientAuth0 } from "../providers/Auth0";
import { CoreClient, createCoreClient } from "./client";

export const createCoreClientWrapper = (config: AuthConfigWithProvider, client: CoreClient) => {
  if (config?.provider === "auth0") {
    return createCoreClientAuth0(config, client);
  }
};
