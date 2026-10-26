import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { useConversationPicture } from "../hooks/use-conversation-picture";

/** A chat's WhatsApp profile picture, else its coloured initials (a photo that fails to load falls back too). */
export function ChatAvatar({ conversationId, name, size }: { conversationId?: string | null; name: string; size: number }) {
  const picture = useConversationPicture(conversationId);
  return <CustomAvatar name={name} src={picture} size={size} colorful />;
}
