import { Logger } from "@auth/oidc-utils";

export const createDefaultLogger = (): Logger => {
  const log = (message: string, ...optionalParams: any[]) => {
    console.log(message, ...optionalParams);
  };

  const error = (message: string, ...optionalParams: any[]) => {
    console.error(message, ...optionalParams);
  };

  const warn = (message: string, ...optionalParams: any[]) => {
    console.warn(message, ...optionalParams);
  };

  return {
    log,
    error,
    warn,
  };
};
