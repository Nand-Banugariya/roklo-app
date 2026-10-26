import { Redirect } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { AuthBackdrop } from "@/features/auth/components/auth-backdrop";
import { AuthIntro, introState } from "@/features/auth/components/auth-intro";
import { useAppSelector } from "@/store/hooks";

export default function Index() {
  const user = useAppSelector((state) => state.auth.user);
  const [introDone, setIntroDone] = useState(introState.played);
  // Signed-out users see the messaging intro once per launch before login.
  if (!user && !introDone)
    return (
      <AuthIntro
        onDone={() => {
          introState.played = true;
          setIntroDone(true);
        }}
      />
    );
  // Same tint and dots as the intro and login page, so the hand-over between
  // them is a plain cross-fade with nothing blank in the middle.
  return (
    <View className="flex-1 bg-brand-100">
      <AuthBackdrop />
      <Redirect
        href={!user ? "/login" : user.isOnboarded ? "/inbox" : "/setup"}
      />
    </View>
  );
}
