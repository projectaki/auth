const runAuthFlow = async () => {
  if (isAuthCallback(config)) {
    eventService.setAuthState(AuthenticationState.Authenticating);

    const res = await processAuthResult();

    validateAtHash(res.id_token, res.access_token);

    evaluateAuthState(res.id_token);

    _storage.set("authResult", res);

    const appState = getAppState();

    if (appState.sendUserBackTo && config.preserveRoute !== false)
      replaceUrlState(appState.sendUserBackTo);

    eventService.emitEvent("AuthComplete");
  } else {
    evaluateAuthState();
  }

  startCheckSessionIfPossible();
};
