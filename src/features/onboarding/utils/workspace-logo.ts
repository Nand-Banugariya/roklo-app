import type { DocumentPickerAsset } from "expo-document-picker";
import type { WorkspaceLogo } from "../types/onboarding.types";
import { logoError } from "./validation";

/** Convert picker metadata to the exact native/web multipart part. */
export function workspaceLogoFromAsset(asset: DocumentPickerAsset, web: boolean): WorkspaceLogo {
  const type = (
    asset.file?.type ||
    asset.mimeType ||
    (/\.png$/i.test(asset.name) ? "image/png" : /\.jpe?g$/i.test(asset.name) ? "image/jpeg" : "")
  ).replace("image/jpg", "image/jpeg");
  const size = asset.file?.size ?? asset.size;
  if (size == null || !Number.isFinite(size))
    throw new Error("We couldn't read this image. Choose another PNG or JPG.");
  const logo: WorkspaceLogo =
    web && asset.file
      ? { kind: "web", file: asset.file, name: asset.name, type, size }
      : { kind: "native", uri: asset.uri, name: asset.name, type, size };
  if (web && !asset.file) throw new Error("We couldn't read this image. Choose it again.");
  const error = logoError(logo);
  if (error) throw new Error(error);
  return logo;
}
