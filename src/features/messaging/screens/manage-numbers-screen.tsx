import { router } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { WhatsAppMark } from "../components/whatsapp-mark";
import { useMessaging } from "../providers/messaging-provider";
import { isConnected, numberName, numberPhone } from "../types";

export function ManageNumbersScreen() {
  const { numbers, api, refreshNumbers } = useMessaging();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!editing || !name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const result = await api.renameNumber(editing, name.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.message || "Couldn't rename the number.");
      return;
    }
    await refreshNumbers();
    setEditing(null);
  }
  return (
    <View className="flex-1 bg-card">
      <ScreenHeader title="Manage numbers" />
      <ScrollView contentContainerClassName="gap-2 py-4">
        {error && (
          <View className="px-5">
            <CustomAlert tone="error">{error}</CustomAlert>
          </View>
        )}
        {numbers.map((number) => (
          <View key={number.id} className="gap-3 border-b border-border px-5 py-5">
            <View className="flex-row items-center gap-3">
              <WhatsAppMark size={28} />
              <View className="flex-1 gap-1">
                <CustomText className="font-sans-semibold text-base">
                  {numberName(number)}
                </CustomText>
                <CustomText className="text-xs text-muted-foreground">
                  {numberPhone(number)} · {isConnected(number) ? "Connected" : "Disconnected"}
                </CustomText>
              </View>
            </View>
            {editing === number.id ? (
              <View className="gap-3">
                <CustomInput
                  accessibilityLabel="Number name"
                  size="xl"
                  value={name}
                  onChangeText={setName}
                  maxLength={60}
                  autoFocus
                  editable={!busy}
                />
                <View className="flex-row gap-2">
                  <CustomButton
                    size="xl"
                    loading={busy}
                    disabled={!name.trim()}
                    onPress={() => void save()}
                    leadingIcon={
                      <CustomIcon as={Check} size={17} className="text-primary-foreground" />
                    }
                  >
                    Save name
                  </CustomButton>
                  <CustomButton
                    variant="ghost"
                    size="xl"
                    disabled={busy}
                    onPress={() => setEditing(null)}
                  >
                    Cancel
                  </CustomButton>
                </View>
              </View>
            ) : (
              <MotionPressable
                role="button"
                accessibilityLabel={`Rename ${numberName(number)}`}
                onPress={() => {
                  setEditing(number.id);
                  setName(number.displayName ?? "");
                }}
                className="min-h-11 flex-row items-center justify-between"
              >
                <CustomText className="font-sans-medium text-sm text-primary">
                  Rename number
                </CustomText>
                <CustomIcon as={ChevronRight} size={16} className="text-primary" />
              </MotionPressable>
            )}
            {!isConnected(number) && (
              <CustomButton
                variant="secondary"
                size="xl"
                onPress={() =>
                  router.push({ pathname: "/connect-number", params: { sessionId: number.id } })
                }
              >
                Reconnect
              </CustomButton>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
