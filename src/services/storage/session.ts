import { createSession } from "./create-session";
import { sessionStorage } from "./session-storage";

export const session = createSession(sessionStorage);
