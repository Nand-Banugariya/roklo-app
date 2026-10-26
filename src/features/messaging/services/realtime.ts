import { io, type Socket } from "socket.io-client";

/**
 * Sent by the API once this socket is in its rooms, on every (re)connect. Events from before
 * then were missed, so this is the moment to re-read current state.
 */
export const JOINED_EVENT = "joined";

/**
 * roklo-api's AppGateway relays WhatsApp webhooks and inbox updates over Socket.IO, as in the web app
 * (lib/realtime/socket.ts): `join` with { userId, workspaceId } puts the socket in the user's room
 * and the workspace's. Rooms don't survive a reconnect, so it joins on every connect.
 */
export function createRealtimeSocket({ baseUrl, getToken, userId, workspaceId }: {
  baseUrl: string; getToken: () => string | null; userId: string; workspaceId: string;
}): Socket {
  const socket = io(baseUrl, {
    // Read on every (re)connect, so a reconnect never sends a stale token.
    auth: (send) => send({ token: getToken() }),
    // Long-polling first, upgraded to a websocket: works behind proxies that block upgrades.
    transports: ["polling", "websocket"],
    autoConnect: false,
  });
  socket.on("connect", () => { socket.emit("join", { userId, workspaceId }); });
  return socket;
}
