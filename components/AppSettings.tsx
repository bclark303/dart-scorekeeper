import { ThemeName } from "@/lib/types";

type AppSettingsProps = {
  brandName: string;
  themeName: ThemeName;
  setBrandName: (brandName: string) => void;
  setThemeName: (themeName: ThemeName) => void;
};

export function AppSettings({
  brandName,
  themeName,
  setBrandName,
  setThemeName,
}: AppSettingsProps) {
  return (
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
            Theme
          </span>
          <select
            className="w-full rounded-xl bg-[var(--color-panel-soft)] border border-[var(--color-panel-border)] p-3"
            value={themeName}
            onChange={(event) => setThemeName(event.target.value as ThemeName)}
          >
            <option value="default">Default Dark</option>
            <option value="firehall">Firehall</option>
          </select>
        </label>
      </div>
    </section>
  );
}