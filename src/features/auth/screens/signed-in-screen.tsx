import { LogOut, ShieldCheck } from "lucide-react-native";
import { View } from "react-native";

import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { useAppSelector } from "@/store/hooks";

import { AuthHeader } from "../components/auth-header";
import { AuthLayout } from "../components/auth-layout";
import { useAuthSession } from "../providers/session-provider";

// Auth handoff only. Workspace setup and the inbox are separate feature modules.
export default function SignedInScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const { signOut } = useAuthSession();
  return (
    <AuthLayout>
      <View className="gap-7">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-brand-100">
          <CustomIcon as={ShieldCheck} size={24} className="text-brand-700" />
        </View>
        <AuthHeader
          title={user?.isOnboarded ? "Welcome back" : "Welcome to Roklo"}
        >
          {user?.isOnboarded
            ? "You’re signed in to your Roklo account."
            : "Your phone number is verified. Your account is ready for workspace setup."}
        </AuthHeader>
        <View className="gap-1.5 rounded-lg border border-border bg-card p-4">
          {user?.name && (
            <CustomText className="font-sans-semibold">{user.name}</CustomText>
          )}
          <CustomText className="text-sm text-ink-700">
            {user?.mobileNumber}
          </CustomText>
        </View>
        <CustomAlert tone="success" title="Signed in successfully">
          Your session is saved on this device.
        </CustomAlert>
        <CustomButton
          variant="secondary"
          size="xl"
          fullWidth
          onPress={() => void signOut()}
          leadingIcon={<CustomIcon as={LogOut} size={16} />}
        >
          Sign out
        </CustomButton>
      </View>
    </AuthLayout>
  );
}
