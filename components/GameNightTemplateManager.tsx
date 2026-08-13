"use client";

import { useState } from "react";

import type { GameNightSettingsSummary } from "@/lib/league/gameNightContracts";
import type { GameNightTemplateListResponse, GameNightTemplateSummary } from "@/lib/league/gameNightTemplates";

export function GameNightTemplateManager({ leagueId, templates, selectedTemplateId, settings, canManage, disabled, onSelect, onApply, onReload, onMessage, onError }: {
  leagueId: string;
  templates: GameNightTemplateSummary[];
  selectedTemplateId: string;
  settings: GameNightSettingsSummary;
  canManage: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onApply: (settings: GameNightSettingsSummary) => void;
  onReload: (preferredId?: string) => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = templates.find((item) => item.id === selectedTemplateId) ?? null;
  const working = disabled || busy;

  async function mutate(method: "POST" | "PATCH", body: object, success: (template: GameNightTemplateSummary) => string) {
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/leagues/game-night-templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as GameNightTemplateListResponse;
      if (!response.ok || !result.template) throw new Error(result.error ?? "Template update failed.");
      await onReload(result.template.id);
      onMessage(success(result.template));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Template update failed.");
    } finally {
      setBusy(false);
    }
  }

  function applySelected() {
    if (!selected) return;
    onApply({ ...selected.settings, intermissionAfterRounds: [...selected.settings.intermissionAfterRounds] });
    onMessage(`Applied “${selected.name}” to the rule draft. Use Save Rules to apply it to this Game Night.`);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-panel-border)] bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Rules Templates</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Reuse league rules without changing nights that already saved their own snapshot.</p>
        </div>
        {selected?.isDefault && <span className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-200">LEAGUE DEFAULT</span>}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <select value={selectedTemplateId} onChange={(event) => onSelect(event.target.value)} className="rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3">
          <option value="">Standard app defaults</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.isDefault ? "Default — " : ""}{template.name}</option>)}
        </select>
        <button type="button" disabled={working || !selected} onClick={applySelected} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-3 text-sm font-bold disabled:opacity-50">Apply to Rule Draft</button>
      </div>

      {selected && <p className="mt-3 text-xs text-[var(--color-text-muted)]">{selected.settings.startingScore} · Best of {selected.settings.legsPerMatch} · {selected.settings.finishRule === "double" ? "Double Out" : "Straight Out"} · {selected.settings.roundCount} round{selected.settings.roundCount === 1 ? "" : "s"}</p>}

      {canManage ? (
        <div className="mt-5 border-t border-[var(--color-panel-border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Regular League Night" className="w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] px-3 py-3" />
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} /> Make league default</label>
            </div>
            <button type="button" disabled={working || !name.trim()} onClick={() => void mutate("POST", { leagueId, name: name.trim(), settings, isDefault: makeDefault }, (template) => { setName(""); setMakeDefault(false); return `Saved template “${template.name}”.`; })} className="self-start rounded-xl bg-[var(--color-primary)] px-4 py-3 font-bold text-white disabled:opacity-50">Save New Template</button>
          </div>
          {selected && <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={working} onClick={() => void mutate("PATCH", { templateId: selected.id, settings }, (template) => `Updated “${template.name}” from the current draft.`)} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50">Update Template from Draft</button>
            {!selected.isDefault && <button type="button" disabled={working} onClick={() => void mutate("PATCH", { templateId: selected.id, isDefault: true }, (template) => `“${template.name}” is now the league default.`)} className="rounded-xl border border-[var(--color-panel-border)] px-4 py-2.5 text-sm font-bold disabled:opacity-50">Make League Default</button>}
          </div>}
        </div>
      ) : <p className="mt-4 text-xs text-[var(--color-text-muted)]">League members can use templates; owners and admins manage them.</p>}
    </section>
  );
}
