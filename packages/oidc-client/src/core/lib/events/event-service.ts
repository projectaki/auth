import { AuthenticationState } from "./auth-state";

export const createEventService = (
  authStateChange: (authState: AuthenticationState) => void,
) => {
  let authState: AuthenticationState = "unauthenticated";

  let onAuthStateChange: (authState: AuthenticationState) => void;

  let onEvent: (event: Event) => void;

  const getAuthState = (): AuthenticationState => {
    return authState;
  };

  const registerAuthStateHandler = (
    authStateEvent: (authState: AuthenticationState) => void,
  ) => {
    onAuthStateChange = authStateEvent;
  };

  const setAuthState = (authState: AuthenticationState) => {
    authState = authState;
    if (onAuthStateChange) onAuthStateChange(authState);
  };

  const emitEvent = (event: Event) => {
    if (onEvent) onEvent(event);
  };

  registerAuthStateHandler(authStateChange);

  return {
    getAuthState,
    setAuthState,
    emitEvent,
  };
};
