import React from "react";
import { createContext } from "react";
import { Session } from "@authts/client-core";
import { ExpoClient } from "./client-expo";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

type ContextProps = {
  session: Session | null;
  //user: User | null;
  loaded: boolean;
};

const AuthContext = createContext<Partial<ContextProps>>({});

interface Props {
  children: React.ReactNode;
  client: ExpoClient;
}

export const AuthProvider = ({ children, client }: Props) => {
  const [session, setSession] = React.useState<Session | null>(null);
  //const [user, setUser] = React.useState<User | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  const url = Linking.useURL();

  // Check session on mount
  React.useEffect(() => {
    const run = async () => {
      const session = await client.getSession();
      setSession(session);

      client.onAuthStateChange((session) => {
        if (session === "unauthenticated") setSession(null);
      });
    };
    try {
      run();
    } catch (error) {
      console.error("CLIENT_SESSION_ERROR", error as Error);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Handle callback
  React.useEffect(() => {
    console.log("URL", url);
    WebBrowser.dismissBrowser();
    client.authCallback();
  }, [url]);

  // Check session periodically

  // React.useEffect(() => {
  //   if (CHECK_SESSION_INTERVAL) {
  //     const refetchIntervalTimer = setInterval(() => {
  //       // CHECK FOR SESSION AND USE REFRSH TOKEN
  //     }, CHECK_SESSION_INTERVAL * 1000)
  //     return () => clearInterval(refetchIntervalTimer)
  //   }
  // }, [CHECK_SESSION_INTERVAL])

  return (
    <AuthContext.Provider
      value={{
        session,
        //user,
        loaded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
