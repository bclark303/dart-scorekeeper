"use client";

import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import { LOCAL_ARCHIVE_CHANGED_EVENT } from "@/lib/persistence";
import {
  readServerStorageMode,
  SERVER_STORAGE_MODE_CHANGED_EVENT,
  type ServerStorageMode,
} from "@/lib/serverStorageMode";
import { syncCompletedMatches } from "@/lib/sync/client";
import {
  DATABASE_SETUP_CHANGED_EVENT,
  type DatabaseSetupStatus,
} from "@/lib/setup/contracts";

/**
 * Fire-and-forget completed-match synchronization.
 *
 * Local Only mode never mounts the auth-aware child, so a database-free scorer
 * does not even make account/session requests. Connected Storage first verifies
 * that the server reports a usable account database.
 */
export function SyncCoordinator() {
  const [mode, setMode] = useState<ServerStorageMode>("local");
  const [databaseReady, setDatabaseReady] = useState(false);

  useEffect(() => {
    const syncMode = () => setMode(readServerStorageMode());
    syncMode();
    window.addEventListener(SERVER_STORAGE_MODE_CHANGED_EVENT, syncMode);
    return () => {
      window.removeEventListener(SERVER_STORAGE_MODE_CHANGED_EVENT, syncMode);
    };
  }, []);

  useEffect(() => {
    if (mode !== "connected") {
      setDatabaseReady(false);
      return;
    }

    let cancelled = false;

    const checkDatabase = () => {
      void fetch("/api/setup/database/status", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as DatabaseSetupStatus;
        })
        .then((status) => {
          if (!cancelled) {
            setDatabaseReady(Boolean(status?.account.ready));
          }
        })
        .catch(() => {
          if (!cancelled) setDatabaseReady(false);
        });
    };

    checkDatabase();
    window.addEventListener(DATABASE_SETUP_CHANGED_EVENT, checkDatabase);

    return () => {
      cancelled = true;
      window.removeEventListener(DATABASE_SETUP_CHANGED_EVENT, checkDatabase);
    };
  }, [mode]);

  if (mode !== "connected" || !databaseReady) {
    return null;
  }

  return <ConnectedSyncCoordinator />;
}

function ConnectedSyncCoordinator() {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id;

  useEffect(() => {
    if (isPending || !userId) {
      return;
    }

    const sync = () => {
      void syncCompletedMatches();
    };

    sync();
    window.addEventListener("online", sync);
    window.addEventListener(LOCAL_ARCHIVE_CHANGED_EVENT, sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener(LOCAL_ARCHIVE_CHANGED_EVENT, sync);
    };
  }, [isPending, userId]);

  return null;
}
