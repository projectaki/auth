export type Event =
  | 'AuthComplete'
  | 'DiscoveryDocumentLoaded'
  | 'JwksLoaded'
  | 'AuthStarted'
  | 'TokensRefreshed'
  | 'Logout'
  | 'SessionChangedOnServer'
  | 'SessionUnchangedOnServer'
  | 'SessionErrorOnServer';
