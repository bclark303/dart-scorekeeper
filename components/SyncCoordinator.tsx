"use client";

import { useEffect } from "react";

import { authClient } from "@/lib/auth/client";
import { LOCAL_ARCHIVE_CHANGED_EVENT } from "@/lib/persistence";
import { syncCompletedMatches } from "@/lib/sync/client";

/**
 * Fire-and-forget completed-match synchronization.
 *
 * This component deliberately renders nothing and is unrelated to scoring
 * state. A failed/offline sync never prevents a dart from being recorded.
 */
export function SyncCoordinator() {
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
