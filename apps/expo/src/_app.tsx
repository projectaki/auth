import { AuthProvider } from "@authts/client-expo";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { client } from "../lib/client";

import { HomeScreen } from "./screens/home";

export const App = () => {
  return (
    <AuthProvider client={client}>
      <SafeAreaProvider>
        <HomeScreen />
        <StatusBar />
      </SafeAreaProvider>
    </AuthProvider>
  );
};
