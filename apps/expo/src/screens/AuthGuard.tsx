import { useSession } from "@authts/client-expo";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Authed from "./authed";
import { HomeScreen } from "./home";

const Stack = createNativeStackNavigator();

function AuthGuard() {
  const { loaded, session } = useSession();

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session ? (
          <Stack.Screen
            name="Unauthenticated"
            component={HomeScreen}
            options={{
              title: "Sign in",
              headerShown: false,
            }}
          />
        ) : (
          <Stack.Screen name="Authenticated" component={Authed} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AuthGuard;
