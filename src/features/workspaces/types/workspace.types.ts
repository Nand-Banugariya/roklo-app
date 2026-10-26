export interface Workspace {
  id: string;
  name: string;
  logo: string | null;
  ownerId?: string;
  role?: "OWNER" | "ADMIN" | "MEMBER";
  isDefault?: boolean;
  isDeleted?: boolean;
  status?: "ENABLED" | "DISABLED";
}

export interface WorkspaceState {
  ownerId: string | null;
  items: Workspace[];
  activeId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  detailError: string | null;
  switchingId: string | null;
  switchError: string | null;
  requests: {
    load: string | null;
    detail: string | null;
    switch: string | null;
  };
}
