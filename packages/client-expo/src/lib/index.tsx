import React from "react";
import { createContext, useContext } from "react";
import { Session } from "@authts/client-core";
import { ExpoClient } from "./client-expo";

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

export const useSession = () => useContext(AuthContext);

export const AuthProvider = ({ children, client }: Props) => {
  const [session, setSession] = React.useState<Session | null>(null);
  //const [user, setUser] = React.useState<User | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  // Check session on mount
  React.useEffect(() => {
    const run = async () => {
      const session = await client.getSession();
      setSession(session);

      client.onAuthStateChange((session) => {
        setSession(session);
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
