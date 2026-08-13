import type { ResolvedGameNightSettings } from "@/lib/league/gameNightContracts";

/** A reusable, league-owned snapshot of Game Night rules. */
export type GameNightTemplateSummary = {
  id: string;
  leagueId: string;
  name: string;
  isDefault: boolean;
  settings: ResolvedGameNightSettings;
  createdAt: number;
  updatedAt: number;
};

export type GameNightTemplateListResponse = {
  templates?: GameNightTemplateSummary[];
  template?: GameNightTemplateSummary;
  error?: string;
};
