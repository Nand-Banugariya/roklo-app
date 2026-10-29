export type AttachmentKind = "image" | "video" | "audio" | "file";

/**
 * What a media URL holds, from its extension (the URLs carry no MIME type), as on the web app.
 * A URL without a known extension falls back to the stored file name's.
 */
export function attachmentKind(url: string, name?: string | null): AttachmentKind {
  const kind = kindOf(url);
  return kind === "file" && name ? kindOf(name) : kind;
}
function kindOf(path: string): AttachmentKind {
  const last = path.split("?")[0].split("/").pop() ?? "";
  const ext = last.includes(".") ? last.split(".").pop()!.toLowerCase() : "";
  if (["jpg", "jpeg", "png", "gif", "webp", "bmp", "avif", "heic"].includes(ext)) return "image";
  if (["mp4", "3gp", "3gpp", "mov", "webm", "m4v"].includes(ext)) return "video";
  if (["ogg", "oga", "opus", "mp3", "m4a", "aac", "wav", "amr"].includes(ext)) return "audio";
  return "file";
}

/** A stored file's display name: drops the "<id>__" storage prefix. */
export function attachmentName(url: string, stored?: string | null) {
  if (stored) return stored;
  let last = url.split("?")[0].split("/").pop() ?? "";
  try {
    last = decodeURIComponent(last);
  } catch {
    /* keep the raw name */
  }
  return last.replace(/^[^_]+__/, "") || "Attachment";
}

/** "PDF", "DOCX"; empty for a name without an extension. */
export function attachmentExtension(name: string) {
  const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";
  return ext.length <= 5 ? ext.toUpperCase() : "";
}

/** Only web URLs open: a file:// or javascript: link from a message never reaches the system. */
export const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

export interface GalleryItem {
  url: string;
  kind: "image" | "video";
  name: string;
}

// The media viewer's items, handed over by the bubble that opened it (URLs are too long for route params).
const galleries = new Map<string, GalleryItem[]>();
export function setGallery(id: string, items: GalleryItem[]) {
  galleries.set(id, items);
  // Keep only the latest few: a viewer opened from an old bubble falls back to Back.
  if (galleries.size > 20) galleries.delete(galleries.keys().next().value!);
}
export const getGallery = (id: string) => galleries.get(id) ?? null;
