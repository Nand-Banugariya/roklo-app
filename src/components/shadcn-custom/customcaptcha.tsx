import { View } from "react-native";
import { WebView } from "react-native-webview";

import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { env } from "@/config/env";
import { captchaUrl, parseCaptchaMessage } from "@/services/captcha/bridge";
import { useRokloTheme } from "@/hooks/use-roklo-theme";

export interface CustomCaptchaProps {
  resetKey: number;
  onToken: (token: string | null) => void;
}

export function CustomCaptcha({ resetKey, onToken }: CustomCaptchaProps) {
  const { mode } = useRokloTheme();
  if (!env.turnstileSiteKey) return null;
  const url = captchaUrl(mode);
  if (!url)
    return (
      <CustomAlert tone="error">We couldn’t load verification. Please try again later.</CustomAlert>
    );
  const origin = new URL(url).origin;
  return (
    <View className="h-[72px] w-full overflow-hidden rounded-md">
      <WebView
        key={`${resetKey}-${mode}`}
        source={{ uri: url }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={{ backgroundColor: "transparent" }}
        thirdPartyCookiesEnabled
        originWhitelist={[
          origin,
          "https://challenges.cloudflare.com",
          "about:blank",
          "about:srcdoc",
        ]}
        onShouldStartLoadWithRequest={(request) => {
          if (request.url === "about:blank" || request.url === "about:srcdoc") return true;
          try {
            return [origin, "https://challenges.cloudflare.com"].includes(
              new URL(request.url).origin,
            );
          } catch {
            return false;
          }
        }}
        onMessage={({ nativeEvent }) => {
          try {
            if (new URL(nativeEvent.url).origin !== origin) return;
          } catch {
            return;
          }
          const token = parseCaptchaMessage(nativeEvent.data);
          if (token !== undefined) onToken(token);
        }}
        onError={() => onToken(null)}
      />
    </View>
  );
}
