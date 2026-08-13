"use client";

import { createAuthClient } from "better-auth/react";

// Better Auth 1.6.x currently has an upstream regression where a deferred
// session revalidation can issue a bodyless POST to /api/auth/get-session.
// Next.js correctly rejects that request with 415, and useSession() can then
// surface the refresh failure even though the normal GET session check worked.
//
// Keep session fetching explicit and conservative until the upstream fix is
// released: initial useSession()/getSession() requests still work normally,
// but focus/offline-triggered background refreshes cannot replace a valid
// session result with that broken deferred POST.
export const authClient = createAuthClient({
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: false,
    refetchWhenOffline: false,
  },
});
