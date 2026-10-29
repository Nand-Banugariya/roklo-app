import * as DocumentPicker from "expo-document-picker";
import { Upload } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { SettingsDescription } from "./settings-section";

/** File selection only; no upload or profile/workspace mutation. */
export function SettingsImagePicker({
  name,
  src,
  square,
  maxMB = 2,
}: {
  name?: string | null;
  src?: string | null;
  square?: boolean;
  maxMB?: number;
}) {
  const [draft, setDraft] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === "web" && draft?.startsWith("blob:"))
      return () => URL.revokeObjectURL(draft);
  }, [draft]);
  async function choose() {
    if (busy) return;
    setError(null);
    setBusy(Platform.OS !== "web");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg"],
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const release = () => {
        if (Platform.OS === "web" && asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
      };
      if (!mounted.current) {
        release();
        return;
      }
      if (!asset.size || asset.size > maxMB * 1024 * 1024 || !/\.(png|jpe?g)$/i.test(asset.name)) {
        release();
        setError(`Choose a PNG or JPG up to ${maxMB} MB.`);
        return;
      }
      setDraft(asset.uri);
    } catch {
      if (mounted.current) setError("We couldn't open your files. Please try again.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const image = draft === undefined ? src : draft;
  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-4">
        <CustomAvatar name={name} src={image} square={square} size={64} />
        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row flex-wrap gap-2">
            <CustomButton
              variant="secondary"
              size="lg"
              loading={busy}
              onPress={() => void choose()}
              leadingIcon={<CustomIcon as={Upload} size={15} className="text-ink-700" />}
            >
              {square ? "Upload logo" : "Upload photo"}
            </CustomButton>
            {!!image && (
              <CustomButton
                variant="ghost"
                size="lg"
                onPress={() => {
                  setDraft(null);
                  setError(null);
                }}
              >
                Remove
              </CustomButton>
            )}
            {draft !== undefined && (
              <CustomButton
                variant="ghost"
                size="lg"
                onPress={() => {
                  setDraft(undefined);
                  setError(null);
                }}
              >
                Reset
              </CustomButton>
            )}
          </View>
          <SettingsDescription>
            PNG or JPG, up to {maxMB} MB{square ? ", square works best" : ""}
          </SettingsDescription>
        </View>
      </View>
      {error && (
        <CustomText accessibilityLiveRegion="polite" className="text-xs text-error-fg">
          {error}
        </CustomText>
      )}
    </View>
  );
}
