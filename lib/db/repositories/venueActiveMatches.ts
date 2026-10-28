import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import { gameNightBoards, gameNightBoardPairings, gameNights, gameNightTeams } from "@/lib/db/game-night-schema";
import { leagueMatchSessions } from "@/lib/db/league-match-schema";
import { seasons } from "@/lib/db/schema";
import { requireVenueAdminForUser } from "@/lib/db/repositories/venueHardware";

export async function listActiveVenueMatches(input:{venueId:string;userId:string}) {
  await requireVenueAdminForUser(input.venueId,input.userId);
  const rows=await getDatabase().select({
    id:leagueMatchSessions.id,status:leagueMatchSessions.status,startedAt:leagueMatchSessions.startedAt,
    updatedAt:leagueMatchSessions.updatedAt,boardId:gameNightBoards.id,boardName:gameNightBoards.name,
    physicalBoardId:gameNightBoards.physicalBoardId,nightName:gameNights.name,
    gameNightId:gameNights.id,nightStatus:gameNights.status,
    teamAId:leagueMatchSessions.teamAId,teamBId:leagueMatchSessions.teamBId,
  }).from(leagueMatchSessions)
    .innerJoin(gameNights,eq(leagueMatchSessions.gameNightId,gameNights.id))
    .innerJoin(gameNightBoards,eq(leagueMatchSessions.boardId,gameNightBoards.id))
    .where(and(eq(gameNights.venueId,input.venueId),eq(leagueMatchSessions.status,"active")));
  const teams=await getDatabase().select({id:gameNightTeams.id,name:gameNightTeams.name}).from(gameNightTeams);
  const names=new Map(teams.map(t=>[t.id,t.name]));
  return rows.map(r=>({...r,teamA:names.get(r.teamAId)??"Team A",teamB:names.get(r.teamBId)??"Team B"}));
}

/** Abandon an unfinished match without granting a win, then release its physical board.
 * The logical slot, session and scored turns remain for audit. Other active matches
 * attached to the same logical slot prevent release.
 */
export async function abandonVenueMatch(input:{venueId:string;userId:string;matchId:string}) {
  await requireVenueAdminForUser(input.venueId,input.userId);
  const now=Date.now();
  return getDatabase().transaction(async tx=>{
    const [match]=await tx.select({
      id:leagueMatchSessions.id,status:leagueMatchSessions.status,pairingId:leagueMatchSessions.pairingId,
      boardId:leagueMatchSessions.boardId,gameNightId:leagueMatchSessions.gameNightId,
      venueId:gameNights.venueId,
    }).from(leagueMatchSessions)
      .innerJoin(gameNights,eq(leagueMatchSessions.gameNightId,gameNights.id))
      .where(eq(leagueMatchSessions.id,input.matchId)).limit(1);
    if(!match||match.venueId!==input.venueId)throw new Error("Match not found at this venue.");
    if(match.status!=="active")throw new Error("Only active matches can be abandoned.");
    const others=await tx.select({id:leagueMatchSessions.id}).from(leagueMatchSessions)
      .where(and(eq(leagueMatchSessions.boardId,match.boardId),eq(leagueMatchSessions.status,"active")));
    if(others.some(other=>other.id!==match.id))throw new Error("Another active match uses this board slot. Resolve it first.");
    await tx.update(leagueMatchSessions).set({status:"cancelled",winnerTeamId:null,completedAt:now,updatedAt:now})
      .where(and(eq(leagueMatchSessions.id,match.id),eq(leagueMatchSessions.status,"active")));
    await tx.update(gameNightBoardPairings).set({status:"cancelled",updatedAt:now})
      .where(eq(gameNightBoardPairings.id,match.pairingId));
    await tx.update(gameNightBoards).set({physicalBoardId:null})
      .where(eq(gameNightBoards.id,match.boardId));
    return {cancelled:true,gameNightId:match.gameNightId,boardReleased:true};
  });
}
