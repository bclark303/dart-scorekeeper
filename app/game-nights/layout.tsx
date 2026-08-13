import type { ReactNode } from "react";
import { LeagueWorkspaceNav } from "@/components/LeagueWorkspaceNav";

export default function GameNightsLayout({ children }: { children: ReactNode }) {
  return <><LeagueWorkspaceNav />{children}</>;
}
