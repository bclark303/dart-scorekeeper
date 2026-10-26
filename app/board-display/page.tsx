"use client";
import { useCallback, useEffect, useState } from "react";
type Enrollment = { requestId: string; verifier: string; pin: string; expiresAt: number };
type Connection = { display: { id: string; name: string; boardNumber: number; boardName: string }; assignment: { gameNightName: string; roundNumber?: number } | null; match: { status: string; currentMemberName: string | null; teamA: { name: string; score: number; members: { displayName: string }[] }; teamB: { name: string; score: number; members: { displayName: string }[] } } | null };
const ENROLL_KEY = "dart-scorekeeper:display-enrollment";
const TOKEN_KEY = "dart-scorekeeper:display-credential";
export default function BoardDisplayPage() {
  const [enrollment,setEnrollment] = useState<Enrollment | null>(null);
  const [token,setToken] = useState("");
  const [connection,setConnection] = useState<Connection | null>(null);
  const [error,setError] = useState("");
  const [stale,setStale] = useState(false);
  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY) ?? "");
    const raw = localStorage.getItem(ENROLL_KEY);
    if(raw) { try { setEnrollment(JSON.parse(raw) as Enrollment); } catch { localStorage.removeItem(ENROLL_KEY); } }
  },[]);
  const refresh = useCallback(async () => {
    try {
      if (token) {
        const response = await fetch("/api/display-device", { cache:"no-store", headers: { Authorization: `Bearer ${token}` } });
        if(response.status===401) {localStorage.removeItem(TOKEN_KEY);setToken("");setConnection(null);return;}
        if(!response.ok) throw new Error("Display service unavailable.");
        setConnection(await response.json() as Connection);setStale(false);setError("");return;
      }
      if(enrollment && enrollment.expiresAt>Date.now()) {
        const response=await fetch(`/api/display-enrollment?requestId=${encodeURIComponent(enrollment.requestId)}`,{cache:"no-store",headers:{"x-display-verifier":enrollment.verifier}});
        if(response.ok) {
          const result=await response.json() as {status:string;credential?:string};
          if(result.status==="paired" && result.credential) {
            localStorage.setItem(TOKEN_KEY,result.credential);localStorage.removeItem(ENROLL_KEY);
            setToken(result.credential);setEnrollment(null);setError("");
          }
          return;
        }
      }
      const response=await fetch("/api/display-enrollment",{method:"POST"});
      if(!response.ok)throw new Error("Could not create pairing PIN.");
      const result=await response.json() as Enrollment;
      localStorage.setItem(ENROLL_KEY,JSON.stringify(result));setEnrollment(result);setError("");
    } catch (cause) {setStale(Boolean(connection));setError(cause instanceof Error?cause.message:"Connection lost");}
  },[token,enrollment,connection]);
  useEffect(()=>{const t=setTimeout(()=>void refresh(),0);const i=setInterval(()=>void refresh(),3000);return()=>{clearTimeout(t);clearInterval(i);};},[refresh]);
  const match=connection?.match;
  return <main className="flex min-h-screen flex-col bg-slate-950 p-8 text-white">
    {stale && <div role="alert" className="rounded-xl bg-amber-900 p-4 text-center text-2xl font-black">CONNECTION LOST — SCORES MAY BE STALE</div>}
    {error && !connection && <div role="alert" className="text-center text-amber-300">{error}</div>}
    {!token ? <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-4xl font-black">PAIR THIS BOARD DISPLAY</h1>
      <p className="text-2xl">In League Manager, choose Pair Display and enter this code:</p>
      <div className="rounded-3xl border-4 border-emerald-400 px-12 py-8 font-mono text-7xl font-black tracking-widest">{enrollment?.pin ?? "······"}</div>
      <p className="text-lg text-slate-300">Code expires in five minutes. The display will connect automatically.</p>
    </section> : <>
      <header className="flex items-center justify-between border-b border-slate-600 pb-4"><h1 className="text-5xl font-black">BOARD {connection?.display.boardNumber ?? "—"}</h1><div className="text-right text-xl">{connection?.assignment?.gameNightName ?? "Waiting for game night"}<p className="text-sm text-slate-300">{connection?.assignment?.roundNumber ? `Round ${connection.assignment.roundNumber}` : "No active match"}</p></div></header>
      {match ? <><div className="mt-5 grid flex-1 grid-cols-2 gap-5">
        {[match.teamA,match.teamB].map(team=><section key={team.name} className="flex flex-col rounded-2xl border-4 border-slate-700 bg-slate-900 p-5"><h2 className="text-3xl font-black">{team.name}</h2><p className="mt-3 text-xl">{team.members.map(m=>m.displayName).join(" / ")}</p><div className="my-auto text-center text-8xl font-black tabular-nums">{team.score}</div></section>)}
        </div><footer className="mt-5 rounded-xl bg-emerald-950 p-5 text-center text-3xl font-black">{match.status==="active" ? `NOW THROWING: ${match.currentMemberName ?? "—"}` : match.status==="completed"?"MATCH COMPLETE":"MATCH READY"}</footer></> :
        <section className="flex flex-1 items-center justify-center text-4xl font-black">Waiting for a match assignment</section>}
    </>}
  </main>;
}
