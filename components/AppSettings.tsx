import { DefaultScoreLayout, RefreshBehavior, ThemeName } from "@/lib/types";

type AppSettingsProps = {
  brandName: string;
  themeName: ThemeName;
  refreshBehavior: RefreshBehavior;
  defaultScoreLayout: DefaultScoreLayout;
  setBrandName: (brandName: string) => void;
  setThemeName: (themeName: ThemeName) => void;
  setRefreshBehavior: (refreshBehavior: RefreshBehavior) => void;
  setDefaultScoreLayout: (layout: DefaultScoreLayout) => void;
};

export function AppSettings({
  brandName,
  themeName,
  refreshBehavior,
  defaultScoreLayout,
  setBrandName,
  setThemeName,
  setRefreshBehavior,
  setDefaultScoreLayout,
}: AppSettingsProps) {
  return (
    <>
      <section className="rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6 mb-8">
        <h2 className="text-2xl font-bold mb-6">App Settings</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Brand Name
            </span>
            <input
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={brandName}
              onChange={(event) => setBrandName(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Default Scoring Layout
            </span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={defaultScoreLayout}
              onChange={(event) =>
                setDefaultScoreLayout(event.target.value as DefaultScoreLayout)
              }
            >
              <option value="compact">Compact</option>
              <option value="full">Full</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Theme
            </span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={themeName}
              onChange={(event) =>
                setThemeName(event.target.value as ThemeName)
              }
            >
              <option value="default">Default Dark</option>
              <option value="firehall">Firehall</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-[var(--color-text-muted)] mb-2">
              Refresh Behavior
            </span>
            <select
              className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
              value={refreshBehavior}
              onChange={(event) =>
                setRefreshBehavior(event.target.value as RefreshBehavior)
              }
            >
              <option value="score">Always open Score tab</option>
              <option value="last">Restore last open tab</option>
            </select>
          </label>
        </div>
      </section>
      <section className="rounded-2xl bg-[var(--color-panel)] border border-[var(--color-panel-border)] p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Tester Notes</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
            <h3 className="text-xl font-bold mb-3">What to Test</h3>

            <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
              <li>Total-turn X01 scoring</li>
              <li>Dart-by-dart X01 scoring</li>
              <li>Straight-out and double-out finishes</li>
              <li>Singles, doubles, and larger team matches</li>
              <li>Uneven teams and dummy-score rotation</li>
              <li>Undo Last Turn, especially after checkouts</li>
              <li>Compact and Full scoring layouts</li>
              <li>Feedback button and diagnostics preview</li>
            </ul>
          </div>

          <div className="rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
            <h3 className="text-xl font-bold mb-3">Known Limitations</h3>

            <ul className="list-disc pl-5 space-y-2 text-[var(--color-text-muted)]">
              <li>X01 is the only supported game type right now.</li>
              <li>No graphical dartboard input yet.</li>
              <li>No league, tournament, or backend sync yet.</li>
              <li>Match data is stored only in this browser on this device.</li>
              <li>Clearing browser data may erase saved matches.</li>
              <li>Feedback submission requires an internet connection.</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-4">
          <h3 className="text-xl font-bold mb-2">Feedback Tips</h3>

          <p className="text-[var(--color-text-muted)]">
            When reporting a bug, include what you were trying to do, what
            happened, and whether you can make it happen again. The feedback
            form includes app diagnostics automatically, but a short description
            still helps a lot.
          </p>
        </div>
      </section>
    </>
  );
}
