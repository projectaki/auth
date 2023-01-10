import { useSession } from "@authts/client-expo";
import { Pressable, Text, View } from "react-native";
import { client } from "../../lib/client";

function Authed() {
  const session = useSession();

  return (
    <View className="flex">
      <Text>Authenticated</Text>
      <Text>{JSON.stringify(session.user, null, 2)}</Text>
      <Pressable
        onPress={() =>
          client.signOut({
            returnTo: "exp://192.168.50.154:19000",
            client_id: "zIB73oRSqof13mYtTIud2usuxtLF7MlU",
          })
        }
      >
        <Text>Sign oput</Text>
      </Pressable>
    </View>
  );
}

export default Authed;
