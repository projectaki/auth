import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { client } from "../../lib/client";

export const HomeScreen = () => {
  return (
    <SafeAreaView className="bg-[#2e026d] bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <View className="h-full w-full p-4">
        <Pressable onPress={() => client.signIn()}>
          <Text>Login</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
