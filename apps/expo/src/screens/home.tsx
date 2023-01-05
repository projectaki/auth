import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const HomeScreen = () => {
  const [test, setTest] = React.useState<any>();

  React.useEffect(() => {
    (async () => {
      setTest("a");
    })();
  }, []);

  return (
    <SafeAreaView className="bg-[#2e026d] bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <View className="h-full w-full p-4">
        <Text>{test}</Text>
      </View>
    </SafeAreaView>
  );
};
