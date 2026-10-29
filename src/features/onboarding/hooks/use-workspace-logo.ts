import * as DocumentPicker from "expo-document-picker";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import type { WorkspaceLogo } from "../types/onboarding.types";
import { workspaceLogoFromAsset } from "../utils/workspace-logo";

export function useWorkspaceLogo() {
  const [logo, setLogo] = useState<WorkspaceLogo | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (Platform.OS === "web" && preview) return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function choose() {
    if (pending.current) return;
    // Some browsers do not resolve cancellation. Keep the upload action usable.
    const native = Platform.OS !== "web";
    pending.current = native;
    setBusy(native);
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg"],
        multiple: false,
        copyToCacheDirectory: true,
        base64: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!mounted.current) {
        if (!native) URL.revokeObjectURL(asset.uri);
        return;
      }
      try {
        const next = workspaceLogoFromAsset(asset, !native);
        setLogo(next);
        setPreview(asset.uri);
      } catch (cause) {
        if (!native) URL.revokeObjectURL(asset.uri);
        throw cause;
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error && /^(Choose |We couldn't read)/.test(cause.message)
            ? cause.message
            : "We couldn't open your files. Please try again.",
        );
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function remove() {
    setLogo(null);
    setPreview(null);
    setError(null);
  }
  return { logo, preview, error, busy, choose, remove };
}
