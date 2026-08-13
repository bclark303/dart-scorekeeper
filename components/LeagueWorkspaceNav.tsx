"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const workspaceItems = [
  { href: "/leagues", label: "Overview" },
  { href: "/game-nights", label: "Game Nights" },
  { href: "/league-roster", label: "Players" },
  { href: "/game-night-templates", label: "Rules" },
  { href: "/league-devices", label: "Boards" },
] as const;

function isWorkspacePath(pathname: string) {
  return (
    pathname === "/leagues" ||
    pathname === "/game-nights" ||
    pathname.startsWith("/game-nights/fixtures") ||
    pathname === "/league-roster" ||
    pathname === "/game-night-templates" ||
    pathname === "/league-devices"
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/game-nights") {
    return pathname === href || pathname.startsWith("/game-nights/fixtures");
  }
  return pathname === href;
}

/**
 * Shared navigation for the league administration workspace.
 *
 * League features have grown beyond a single page, so this bar keeps the
 * primary destinations in a predictable location instead of relying on each
 * page to provide a different set of back/side links.
 */
export function LeagueWorkspaceNav() {
  const pathname = usePathname();

  if (!isWorkspacePath(pathname)) return null;

  return (
    <div className="sticky top-0 z-40 border-b border-[var(--color-panel-border)] bg-[var(--color-app-bg)]/95 px-3 py-2 backdrop-blur print:hidden sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 py-2 text-sm font-bold hover:bg-[var(--color-panel-soft)]"
        >
          ← Play
        </Link>

        <div className="hidden shrink-0 sm:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            League
          </div>
          <div className="text-sm font-bold">Workspace</div>
        </div>

        <nav
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-1"
          aria-label="League workspace"
        >
          {workspaceItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-[var(--color-primary)] text-white"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-panel-soft)] hover:text-[var(--color-text-main)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
