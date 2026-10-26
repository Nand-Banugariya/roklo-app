import { Stack } from "expo-router";

import { SignInProvider } from "@/features/auth/providers/sign-in-provider";

export default function AuthLayout() {
  return (
    <SignInProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="email" />
        <Stack.Screen name="verify-otp" />
      </Stack>
    </SignInProvider>
  );
}
