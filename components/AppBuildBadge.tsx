"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { APP_VERSION } from "@/lib/appInfo";

const TEMPLATE_AREAS = [
  "/leagues",
  "/league-roster",
  "/league-devices",
  "/game-nights",
  "/game-night-templates",
];

/** Small always-visible build marker so preview testers can confirm their bundle. */
export function AppBuildBadge() {
  const pathname = usePathname();
  const showTemplateShortcut = TEMPLATE_AREAS.some(
    (area) => pathname === area || pathname.startsWith(`${area}/`),
  );

  return (
    <div className="fixed bottom-2 left-2 z-50 flex items-center gap-2 print:hidden">
      <span className="rounded-full border border-[var(--color-panel-border)] bg-[var(--color-panel)]/95 px-2.5 py-1 text-[10px] font-bold text-[var(--color-text-muted)] shadow-sm backdrop-blur">
        v{APP_VERSION}
      </span>
      {showTemplateShortcut && pathname !== "/game-night-templates" && (
        <Link
          href="/game-night-templates"
          className="rounded-full border border-[var(--color-panel-border)] bg-[var(--color-panel)]/95 px-2.5 py-1 text-[10px] font-bold shadow-sm backdrop-blur"
        >
          Rules Templates
        </Link>
      )}
    </div>
  );
}
