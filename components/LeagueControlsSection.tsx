import Link from "next/link";

const leagueControlCards = [
  {
    href: "/leagues",
    title: "League Center",
    description:
      "Create and manage leagues and seasons, including the season structure that game nights belong to.",
  },
  {
    href: "/league-roster",
    title: "Players & Rosters",
    description:
      "Maintain persistent league players and choose which players are active on each season roster.",
  },
  {
    href: "/game-nights",
    title: "Game Nights",
    description:
      "Schedule league nights, check players in, record dues, build teams, populate boards, and start play.",
  },
] as const;

export function LeagueControlsSection() {
  return (
    <>
      <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
        <div className="mb-5">
          <div className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-muted)]">
            League Administration
          </div>
          <h2 className="mt-1 text-3xl font-bold">League Controls</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Manage the league structure separately from casual scoring and app
            configuration. League features use Connected Storage and a signed-in
            account, while ordinary scoring remains local-first.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {leagueControlCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-5 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-panel-border)]"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-bold">{card.title}</h3>
                <span
                  aria-hidden="true"
                  className="text-xl text-[var(--color-text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--color-text-main)]"
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

      <section className="mb-8 rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-6">
        <h2 className="text-xl font-bold">League-night workflow</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "League & season", "Choose the competition period."],
            ["2", "Season roster", "Choose who is eligible to play."],
            ["3", "Game night", "Check in players and record dues."],
            ["4", "Teams & boards", "Build teams, populate boards, and start."],
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
