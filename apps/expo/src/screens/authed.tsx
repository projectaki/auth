import { Pressable, Text, View } from "react-native";
import { client } from "../../lib/client";

function Authed() {
  return (
    <View className="flex">
      <Text>Authenticated</Text>
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
