import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { goBack } from "@/features/navigation/components/screen-header";
import { InboxState } from "../components/inbox-state";
import { MediaGallery } from "../components/media-viewer";
import { getGallery } from "../utils/attachments";

/**
 * A message's photos and videos on their own screen. Chats open them over the chat instead (MediaViewerOverlay);
 * this route is the fallback for media shown anywhere else.
 */
export function MediaViewerScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const items = getGallery(id);
  if (!items?.length)
    return (
      <View className="flex-1 bg-card">
        <InboxState
          title="This media isn't available"
          description="Go back to the chat and open it again."
          action="Back to chat"
          onAction={goBack}
        />
      </View>
    );
  return <MediaGallery items={items} start={Number(index) || 0} onBack={goBack} />;
}
