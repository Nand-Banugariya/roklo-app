import { router } from "expo-router";
import { MessageCircle, Search } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { CustomAlert } from "@/components/shadcn-custom/customalert";
import { CustomAvatar } from "@/components/shadcn-custom/customavatar";
import { CustomButton } from "@/components/shadcn-custom/custombutton";
import { CustomIcon } from "@/components/shadcn-custom/customicon";
import { CustomInput } from "@/components/shadcn-custom/custominput";
import { CustomSpinner } from "@/components/shadcn-custom/customspinner";
import { CustomText } from "@/components/shadcn-custom/customtext";
import { MotionPressable } from "@/features/navigation/components/motion-pressable";
import { ScreenHeader } from "@/features/navigation/components/screen-header";
import { InboxSkeleton, InboxState } from "../components/inbox-state";
import { useMessaging } from "../providers/messaging-provider";
import { isConnected, numberName } from "../types";

type Contact = { id: string; name: string | null; mobileNumber: string };
export function NewChatScreen() {
  const { api, activeNumber } = useMessaging();
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const offset = useRef(0);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      setContacts([]);
      offset.current = 0;
      const result = await api.contacts(query, 0, controller.signal);
      if (controller.signal.aborted) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.message || "Couldn't load contacts.");
        return;
      }
      setContacts(result.data.contacts);
      offset.current = result.data.contacts.length;
      setMore(result.data.hasMore);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, query, retry]);
  async function loadMore() {
    if (!more || loading) return;
    const signal = request.current?.signal;
    setLoading(true);
    const result = await api.contacts(query, offset.current, signal);
    if (signal?.aborted) return;
    setLoading(false);
    if (!result.ok) {
      setError(result.message || "Couldn't load more contacts.");
      return;
    }
    offset.current += result.data.contacts.length;
    setMore(result.data.hasMore);
    setContacts((old) => [
      ...new Map([...old, ...result.data.contacts].map((row) => [row.id, row])).values(),
    ]);
  }
  async function open(contact: Contact) {
    if (!activeNumber || !isConnected(activeNumber) || lock.current) return;
    lock.current = true;
    setOpening(contact.id);
    setError(null);
    const result = await api.openContact(activeNumber.id, contact.id);
    lock.current = false;
    setOpening(null);
    if (!result.ok) {
      setError(result.message || "Couldn't start the conversation.");
      return;
    }
    router.replace({
      pathname: "/chat/[id]",
      params: { id: result.data.id, sessionId: activeNumber.id },
    });
  }
  return (
    <View className="flex-1 bg-card">
      <ScreenHeader
        title="New chat"
        subtitle={
          activeNumber ? `Send from ${numberName(activeNumber)}` : "Choose a WhatsApp number"
        }
      />
      {!activeNumber || !isConnected(activeNumber) ? (
        <InboxState
          icon={MessageCircle}
          title="Connect a number first"
          description="Choose a connected WhatsApp number to start a conversation."
          action="WhatsApp numbers"
          onAction={() => router.push("/connections")}
        />
      ) : (
        <>
          <View className="mx-5 my-4 flex-row items-center gap-2 rounded-xl bg-accent px-3">
            <CustomIcon as={Search} size={20} className="text-muted-foreground" />
            <CustomInput
              size="xl"
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search contacts"
              placeholder="Search name or number"
              className="min-w-0 flex-1 border-0 bg-transparent"
            />
          </View>
          {error && (
            <View className="gap-1 px-5">
              <CustomAlert tone="error">{error}</CustomAlert>
              <CustomButton variant="link" onPress={() => setRetry((value) => value + 1)}>
                Try again
              </CustomButton>
            </View>
          )}
          {loading && !contacts.length ? (
            <InboxSkeleton />
          ) : (
            <FlatList
              data={contacts}
              keyExtractor={(contact) => contact.id}
              onEndReached={() => void loadMore()}
              onEndReachedThreshold={0.4}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <MotionPressable
                  role="button"
                  accessibilityLabel={`Chat with ${item.name || item.mobileNumber}`}
                  disabled={!!opening}
                  onPress={() => void open(item)}
                  className="min-h-20 flex-row items-center gap-3 px-5 py-4 active:bg-accent"
                >
                  <CustomAvatar name={item.name || item.mobileNumber} size={44} />
                  <View className="min-w-0 flex-1 gap-1">
                    <CustomText className="font-sans-semibold text-base" numberOfLines={1}>
                      {item.name || item.mobileNumber}
                    </CustomText>
                    <CustomText className="text-xs text-muted-foreground">
                      {item.mobileNumber}
                    </CustomText>
                  </View>
                  {opening === item.id && <CustomSpinner />}
                </MotionPressable>
              )}
              ListEmptyComponent={
                !error ? (
                  <InboxState
                    icon={MessageCircle}
                    title={query ? "No matching contacts" : "Your customers belong here"}
                    description={
                      query
                        ? "Try a different name or phone number."
                        : "Add customers in Contacts, then start a conversation here."
                    }
                    action="Open contacts"
                    onAction={() => router.navigate("/contacts")}
                  />
                ) : null
              }
              ListFooterComponent={loading && contacts.length ? <CustomSpinner /> : null}
            />
          )}
        </>
      )}
    </View>
  );
}
