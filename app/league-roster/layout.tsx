import Link from "next/link";
import { LeagueWorkspaceNav } from "@/components/LeagueWorkspaceNav";

export default function LeagueWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LeagueWorkspaceNav />
      <div className="mx-auto max-w-5xl px-4 pt-3 sm:px-6">
        <Link
          href="/game-nights/check-in"
          className="inline-flex rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-4 py-2 text-sm font-black text-[var(--color-primary)]"
        >
          Game Night Check-in →
        </Link>
      </div>
      {children}
    </>
  );
}
