import fs from "node:fs";

const path = "app/game-nights/page.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Could not apply ${label}.`);
  source = source.replace(before, after);
}

replaceOnce(
  '<label className="text-sm">Dummy players<select value={settingsDraft.dummyPlayerMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, dummyPlayerMode: event.target.value as GameNightSettingsSummary["dummyPlayerMode"] })} className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"><option value="none">None</option><option value="allow">Allowed if needed</option><option value="fill">Auto-fill to minimum</option></select></label>\n',
  '<label className="text-sm">Dummy players<select value={settingsDraft.dummyPlayerMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, dummyPlayerMode: event.target.value as GameNightSettingsSummary["dummyPlayerMode"] })} className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2"><option value="none">None</option><option value="allow">Allowed if needed</option><option value="fill">Auto-fill to minimum</option></select></label>\n                <label className="text-sm">Dummy turn score<input type="number" min={0} max={180} value={settingsDraft.dummyScore} onChange={(event) => setSettingsDraft({ ...settingsDraft, dummyScore: numberValue(event.target.value, 0) })} className="mt-1 w-full rounded-xl border border-[var(--color-panel-border)] bg-[var(--color-panel-soft)] p-2" /></label>\n',
  "dummy score field",
);

replaceOnce(
  'onClick={() => void patchGameNight({ action: "populateBoards", gameNightId: selectedNight.id }, "Boards populated for round one.")}',
  'onClick={() => void patchGameNight({ action: "populateBoards", gameNightId: selectedNight.id }, "Boards populated and central match sessions created for round one.")}',
  "board population message",
);

const oldBoardGrid = '<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{selectedNight.boards.map((board) => { const pairing = selectedNight.pairings.find((item) => item.boardId === board.id && item.roundNumber === 1); const teamA = selectedNight.teams.find((team) => team.id === pairing?.teamAId); const teamB = selectedNight.teams.find((team) => team.id === pairing?.teamBId); return <div key={board.id} className="rounded-xl border border-[var(--color-panel-border)] p-4"><div className="font-bold">{board.name}</div>{pairing ? <div className="mt-3 text-center"><div className="font-bold">{teamA?.name}</div><div className="my-1 text-xs text-[var(--color-text-muted)]">vs</div><div className="font-bold">{teamB?.name}</div><div className="mt-3 text-xs text-[var(--color-text-muted)]">{selectedNight.settings.startingScore} · {selectedNight.settings.legsPerMatch} legs · {selectedNight.settings.finishRule} out</div></div> : <div className="mt-3 text-sm text-[var(--color-text-muted)]">Not populated</div>}</div>; })}</div>';

const newBoardGrid = `<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {selectedNight.boards.map((board) => {
                  const pairing = selectedNight.pairings.find((item) => item.boardId === board.id && item.roundNumber === 1);
                  const teamA = selectedNight.teams.find((team) => team.id === pairing?.teamAId);
                  const teamB = selectedNight.teams.find((team) => team.id === pairing?.teamBId);
                  const winner = selectedNight.teams.find((team) => team.id === pairing?.winnerTeamId);
                  return (
                    <div key={board.id} className="rounded-xl border border-[var(--color-panel-border)] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">{board.name}</div>
                        {pairing?.matchStatus && <span className="rounded-full border border-[var(--color-panel-border)] px-2 py-1 text-[10px] font-bold uppercase">{pairing.matchStatus}</span>}
                      </div>
                      {pairing ? (
                        <div className="mt-3 text-center">
                          <div className="font-bold">{teamA?.name}</div>
                          <div className="my-1 text-xs text-[var(--color-text-muted)]">vs</div>
                          <div className="font-bold">{teamB?.name}</div>
                          <div className="mt-3 text-xs text-[var(--color-text-muted)]">{selectedNight.settings.startingScore} · {selectedNight.settings.legsPerMatch} legs · {selectedNight.settings.finishRule} out</div>
                          {winner && <div className="mt-2 text-xs font-bold text-emerald-300">Winner: {winner.name}</div>}
                          {pairing.matchSessionId && (
                            <Link href={\`/league-match/\${pairing.matchSessionId}\`} className="mt-4 inline-flex rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white">
                              Open Scorer
                            </Link>
                          )}
                        </div>
                      ) : <div className="mt-3 text-sm text-[var(--color-text-muted)]">Not populated</div>}
                    </div>
                  );
                })}
              </div>`;
replaceOnce(oldBoardGrid, newBoardGrid, "board scorer links");

replaceOnce(
  '"Game night started. Board-to-scorer launch is the next integration layer."',
  '"Game night started. Board scorers can now start their assigned matches."',
  "start message",
);

fs.writeFileSync(path, source);
