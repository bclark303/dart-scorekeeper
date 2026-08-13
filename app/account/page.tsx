import Link from "next/link";
import { AccountSyncPanel } from "@/components/AccountSyncPanel";

export default function AccountPage() {
  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-start justify-between gap-4"><div><Link href="/league-play" className="text-sm font-black text-[var(--color-primary)]">← League Play</Link><h1 className="mt-2 text-3xl font-black">Account</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">Sign in to open your league workspace and synchronize completed matches.</p></div><Link href="/help?from=account" aria-label="Help" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 font-black">?</Link></header>
        <AccountSyncPanel />
      </div>
    </main>
  );
}
