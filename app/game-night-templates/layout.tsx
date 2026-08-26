import { LeagueWorkspaceNav } from "@/components/LeagueWorkspaceNav";

export default function LeagueWorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <LeagueWorkspaceNav />
      {children}
    </>
  );
}
