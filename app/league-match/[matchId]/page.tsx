import { LeagueMatchScorer } from "@/components/LeagueMatchScorer";

export default async function LeagueMatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <LeagueMatchScorer matchId={matchId} />;
}
