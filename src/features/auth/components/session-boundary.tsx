import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { useAppSelector } from "@/store/hooks";

import { useAuthSession } from "../providers/session-provider";
import { AuthBackdrop } from "./auth-backdrop";

export function SessionBoundary({ children }: PropsWithChildren) {
  const status = useAppSelector((state) => state.auth.status);
  const { retryRestore, signOut } = useAuthSession();

  // Restoring the saved session: show only the intro's own backdrop (no logo
  // or spinner), so the intro that follows starts on the same screen.
  if (status === "restoring")
    return (
      <View className="flex-1 bg-brand-100">
        <AuthBackdrop />
      </View>
    );

  if (status === "restoreError")
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink-50 px-6">
        <View className="w-full max-w-sm items-center gap-8">
          <CustomAlert tone="warning">
            We couldn’t restore your session. Check your connection and try again.
          </CustomAlert>
          <CustomButton size="xl" fullWidth onPress={retryRestore}>
            Try again
          </CustomButton>
          <CustomButton variant="link" onPress={() => void signOut()}>
            Sign in again
          </CustomButton>
        </View>
      </SafeAreaView>
    );

  return children;
}
