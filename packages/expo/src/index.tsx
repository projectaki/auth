import React from "react";
import { createContext } from "react";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Session {
  id_token: string;
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  user: User;
}

type ContextProps = {
  session: Session | null;
  user: User | null;
  loaded: boolean;
};

const AuthContext = createContext<Partial<ContextProps>>({});

interface Props {
  children: React.ReactNode;
}

const AuthProvider = (props: Props) => {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  // Check session on mount
  React.useEffect(() => {
    try {
      // Get session from storage
      // If session doesnt exists set session to null
      // If session exists, check if session is expired
      // If session is not expired, set session
      // If session is expired, check for refresh token
      // If refresh token is expired, set session to null
      // If refresh token is not expired, use refresh token to get new session
    } catch (error) {
      console.error("CLIENT_SESSION_ERROR", error as Error);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Handle callback
  React.useEffect(() => {
    // extract params from url
    // use code to request tokens
    // set session
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
      {props.children}
    </AuthContext.Provider>
  );
};
