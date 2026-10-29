import { useEffect, useRef } from "react";

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
  const ref = useRef<HTMLIFrameElement>(null);
  const url = captchaUrl(mode);
  useEffect(() => {
    if (!url) return;
    const origin = new URL(url).origin;
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== origin ||
        event.source !== ref.current?.contentWindow ||
        typeof event.data !== "string"
      )
        return;
      const token = parseCaptchaMessage(event.data);
      if (token !== undefined) onToken(token);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [url, onToken]);
  if (!env.turnstileSiteKey) return null;
  if (!url)
    return (
      <CustomAlert tone="error">We couldn’t load verification. Please try again later.</CustomAlert>
    );
  return (
    <iframe
      ref={ref}
      key={`${resetKey}-${mode}`}
      src={url}
      title="Security verification"
      style={{
        width: "100%",
        height: 72,
        border: 0,
        background: "transparent",
      }}
    />
  );
}
