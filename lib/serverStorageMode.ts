export type ServerStorageMode = "local" | "connected";

export const SERVER_STORAGE_MODE_KEY = "dart-scorekeeper:server-storage-mode";
export const SERVER_STORAGE_MODE_CHANGED_EVENT =
  "dart-scorekeeper:server-storage-mode-changed";

export function readServerStorageMode(): ServerStorageMode {
  if (typeof window === "undefined") {
    return "local";
  }

  return window.localStorage.getItem(SERVER_STORAGE_MODE_KEY) === "connected"
    ? "connected"
    : "local";
}

export function writeServerStorageMode(mode: ServerStorageMode) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SERVER_STORAGE_MODE_KEY, mode);
  window.dispatchEvent(
    new CustomEvent<ServerStorageMode>(SERVER_STORAGE_MODE_CHANGED_EVENT, {
      detail: mode,
    }),
  );
}
