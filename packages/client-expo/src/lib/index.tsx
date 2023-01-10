import React from "react";
import { createContext, useContext } from "react";
import { Session } from "@authts/client-core";
import { ExpoClient } from "./client-expo";

type ContextProps = {
  session: Session | null;
  user: any | null;
  loaded: boolean;
};

const AuthContext = createContext<Partial<ContextProps>>({});

interface Props {
  children: React.ReactNode;
  client: ExpoClient;
}

export const useSession = () => useContext(AuthContext);

export const AuthProvider = ({ children, client }: Props) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<any | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  // Check session on mount
  React.useEffect(() => {
    const run = async () => {
      const session = await client.getSession();
      setSession(session);
      setUser(session?.user);

      client.onAuthStateChange((session) => {
        setSession(session);
        setUser(session?.user);
      });
    };
    run()
      .catch((e) => console.error("CLIENT_SESSION_ERROR", e as Error))
      .finally(() => setLoaded(true));
  }, []);

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
        user,
        loaded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
