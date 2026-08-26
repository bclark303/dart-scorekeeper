import Link from "next/link";

const setupCards = [
  {
    href: "/leagues",
    title: "League & Seasons",
    description: "Create the league and organize its competition seasons.",
  },
  {
    href: "/league-roster",
    title: "Players & Rosters",
    description: "Maintain league players and choose the active roster for each season.",
  },
  {
    href: "/game-night-templates",
    title: "Rules Templates",
    description: "Save reusable Game Night rules and choose the league default preset.",
  },
  {
    href: "/league-devices",
    title: "Board Devices",
    description: "Register, pair, and manage the scorer assigned to each physical board.",
  },
] as const;

export function LeagueControlsSection() {
  return (
    <>
      <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:p-6">
        <div className="mb-5">
          <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            League Workspace
          </div>
          <h2 className="mt-1 text-3xl font-bold">League</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Run a league night or manage the reusable setup behind it. League administration
            uses Connected Storage; casual play remains local-first and independent.
          </p>
        </div>

        <Link
          href="/game-nights"
          className="group mb-4 block rounded-2xl border border-[var(--color-primary)]/60 bg-[var(--color-panel-soft)] p-5 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-panel-border)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                Run / Test
              </div>
              <h3 className="mt-1 text-2xl font-bold">Game Nights</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)]">
                Schedule the night, check players in, build teams, review the full fixture
                schedule, populate boards, and follow live matches.
              </p>
            </div>
            <span
              className="text-2xl text-[var(--color-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--color-text-main)]"
              aria-hidden="true"
            >
              →
            </span>
          </div>
        </Link>

        <div className="grid gap-3 sm:grid-cols-2">
          {setupCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-panel-border)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold">{card.title}</h3>
                <span
                  aria-hidden="true"
                  className="text-lg text-[var(--color-text-muted)] transition group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5 sm:p-6">
        <h2 className="text-xl font-bold">Typical league-night flow</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Setup areas are reusable; Game Nights are where the live session happens.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "League & season", "Choose the competition period."],
            ["2", "Roster", "Confirm who is eligible to play."],
            ["3", "Rules & boards", "Reuse presets and registered devices."],
            ["4", "Game Night", "Check in, build teams, and run the rounds."],
          ].map(([step, title, description]) => (
            <div
              key={step}
              className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-4"
            >
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
                Step {step}
              </div>
              <div className="mt-1 font-bold">{title}</div>
              <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                {description}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
