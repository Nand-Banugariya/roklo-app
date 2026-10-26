import { useEffect, useSyncExternalStore } from "react";
import { useMessaging } from "../providers/messaging-context";
import { cachedPicture, loadPicture, subscribePictures } from "../services/picture-cache";

/**
 * A chat's profile picture URL, or null while loading or when it has none (the web app's
 * useConversationPicture). Lists only render the rows on screen, so rows fetch as they scroll in.
 */
export function useConversationPicture(id: string | null | undefined) {
  const { api } = useMessaging();
  const url = useSyncExternalStore(subscribePictures, () => (id ? cachedPicture(id) : null));
  useEffect(() => {
    if (id) loadPicture(id, api.picture);
  }, [id, api]);
  return url ?? null;
}
