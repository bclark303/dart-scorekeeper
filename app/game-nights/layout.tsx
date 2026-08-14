import type { ReactNode } from "react";

import { GameNightSectionNav } from "@/components/GameNightSectionNav";
import { LeagueWorkspaceNav } from "@/components/LeagueWorkspaceNav";

export default function GameNightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <LeagueWorkspaceNav />
      <GameNightSectionNav />
      {children}
    </>
  );
}
