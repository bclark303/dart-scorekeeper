"use client";

import { FormEvent, useEffect, useState } from "react";

import { authClient } from "@/lib/auth/client";
import {
  listPendingLocalX01MatchArchives,
  LOCAL_ARCHIVE_CHANGED_EVENT,
} from "@/lib/persistence";
import { syncCompletedMatches } from "@/lib/sync/client";

type AuthMode = "sign-in" | "sign-up";

function describeAuthError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Authentication failed. Check the details and try again.";
}

export function AccountSyncPanel() {
  const {
    data: session,
    isPending: isSessionPending,
    error: sessionError,
  } = authClient.useSession();
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const refreshPendingCount = () => {
      void listPendingLocalX01MatchArchives()
        .then((records) => {
          if (!cancelled) setPendingCount(records.length);
        })
        .catch(() => {
          // IndexedDB availability is surfaced in History; account controls can
          // continue to render even when the browser archive is unavailable.
        });
    };

    refreshPendingCount();
    window.addEventListener(LOCAL_ARCHIVE_CHANGED_EVENT, refreshPendingCount);

    return () => {
      cancelled = true;
      window.removeEventListener(
        LOCAL_ARCHIVE_CHANGED_EVENT,
        refreshPendingCount,
      );
    };
  }, []);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const result =
        authMode === "sign-up"
          ? await authClient.signUp.email({
              name: name.trim(),
              email: email.trim(),
              password,
            })
          : await authClient.signIn.email({
              email: email.trim(),
              password,
            });

      if (result.error) {
        setErrorMessage(describeAuthError(result.error));
        return;
      }

      setPassword("");
      setStatusMessage(
        authMode === "sign-up"
          ? "Account created. Completed match history can now synchronize."
          : "Signed in. Completed match history will synchronize automatically.",
      );

      void handleSyncNow();
    } catch (error) {
      setErrorMessage(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    setErrorMessage("");

    try {
      const result = await syncCompletedMatches();
      setPendingCount(result.pending);
      setStatusMessage(result.message);
      if (result.status === "error") {
        setErrorMessage(result.message);
      }
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSignOut() {
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await authClient.signOut();
      if (result.error) {
        setErrorMessage(describeAuthError(result.error));
        return;
      }
      setStatusMessage(
        "Signed out. Scoring and local completed-match history remain available on this device.",
      );
    } catch (error) {
      setErrorMessage(describeAuthError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Account & Sync</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">
            An account is optional. Scoring stays local-first and works without
            signing in; an account adds server backup and cross-device completed-match history.
          </p>
        </div>

        {!isSessionPending && !sessionError && (
          <div className="rounded-full border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-1.5 text-xs font-bold">
            {session?.user ? "Signed in" : "Local only"}
          </div>
        )}
      </div>

      {isSessionPending && (
        <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 text-[var(--color-text-muted)]">
          Checking account session…
        </div>
      )}

      {!isSessionPending && sessionError && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="font-bold text-amber-100">Account service unavailable</div>
          <p className="mt-1 text-sm text-amber-100/80">
            Scoring still works normally and completed matches remain queued on
            this device. Server backup and cross-device sync will resume when the
            account service is available.
          </p>
          {pendingCount > 0 && (
            <p className="mt-2 text-sm text-amber-100/80">
              {pendingCount} completed {pendingCount === 1 ? "match is" : "matches are"} safely waiting locally.
            </p>
          )}
        </div>
      )}

      {!isSessionPending && !sessionError && session?.user && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Account
              </div>
              <div className="mt-1 font-bold">{session.user.name}</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {session.user.email}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Local sync queue
              </div>
              <div className="mt-1 text-2xl font-bold">{pendingCount}</div>
              <div className="text-sm text-[var(--color-text-muted)]">
                {pendingCount === 1 ? "completed match pending" : "completed matches pending"}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSyncNow()}
              disabled={isSyncing}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSyncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSubmitting}
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-4 py-2.5 font-bold hover:bg-[var(--color-panel-border)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {!isSessionPending && !sessionError && !session?.user && (
        <div className="space-y-4">
          <div className="flex w-fit rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode("sign-in");
                setErrorMessage("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                authMode === "sign-in"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("sign-up");
                setErrorMessage("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                authMode === "sign-up"
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="grid gap-3 sm:grid-cols-2">
            {authMode === "sign-up" && (
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">Name</span>
                <input
                  required
                  maxLength={100}
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
                />
              </label>
            )}

            <label>
              <span className="mb-1 block text-sm font-semibold">Email</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold">Password</span>
              <input
                required
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete={
                  authMode === "sign-up" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-3"
              />
            </label>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? "Working…"
                  : authMode === "sign-up"
                    ? "Create account"
                    : "Sign in"}
              </button>

              {pendingCount > 0 && (
                <span className="text-sm text-[var(--color-text-muted)]">
                  {pendingCount} local {pendingCount === 1 ? "match" : "matches"} will sync after sign-in.
                </span>
              )}
            </div>
          </form>

          <p className="text-xs text-[var(--color-text-muted)]">
            Alpha note: email verification and password-reset email are not configured yet.
          </p>
        </div>
      )}

      {statusMessage && !errorMessage && !sessionError && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {statusMessage}
        </div>
      )}

      {errorMessage && !sessionError && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {errorMessage}
        </div>
      )}
    </section>
  );
}
