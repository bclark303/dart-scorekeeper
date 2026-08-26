import Link from "next/link";
import { APP_VERSION } from "@/lib/appInfo";

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-app-bg)] p-4 text-[var(--color-text-main)] sm:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div><Link href="/" className="text-sm font-black text-[var(--color-primary)]">← Home</Link><h1 className="mt-2 text-3xl font-black">Settings</h1><p className="mt-1 text-sm text-[var(--color-text-muted)]">General application settings. League-specific rules stay inside League Setup.</p></div>
          <Link href="/help?from=settings" aria-label="Help" className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 font-black">?</Link>
        </header>
        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/casual" className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-primary)]"><div className="text-sm font-black uppercase tracking-wide text-[var(--color-text-muted)]">Scoring</div><h2 className="mt-1 text-xl font-black">Casual preferences</h2><p className="mt-2 text-sm text-[var(--color-text-muted)]">Match rules, input style, and local scoring preferences.</p></Link>
          <Link href="/board-device" className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-primary)]"><div className="text-sm font-black uppercase tracking-wide text-[var(--color-text-muted)]">Device</div><h2 className="mt-1 text-xl font-black">Board settings</h2><p className="mt-2 text-sm text-[var(--color-text-muted)]">Pairing, connection, and board-device controls.</p></Link>
          <Link href="/account" className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 hover:border-[var(--color-primary)]"><div className="text-sm font-black uppercase tracking-wide text-[var(--color-text-muted)]">Account</div><h2 className="mt-1 text-xl font-black">Login & sync</h2><p className="mt-2 text-sm text-[var(--color-text-muted)]">Sign in, sign out, and synchronize completed matches.</p></Link>
        </section>
        <div className="mt-6 text-center text-xs text-[var(--color-text-muted)]">Dart Scorekeeper v{APP_VERSION}</div>
      </div>
    </main>
  );
}
