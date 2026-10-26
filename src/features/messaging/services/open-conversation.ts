// The chat open on screen, if any: it keeps its own stored copy current, so the background sync skips it.
let open: string | null = null;
export function setOpenConversation(id: string | null) { open = id; }
export const openConversation = () => open;
