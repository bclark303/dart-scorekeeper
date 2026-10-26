"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import type { LeagueListResponse } from "@/lib/league/contracts";
import type { VenueHardwareResponse } from "@/lib/league/boardDeviceContracts";

export default function PairDisplayPage() {
  const { data: session, isPending } = authClient.useSession();
  const [leagueId,setLeagueId]=useState("");
  const [hardware,setHardware]=useState<VenueHardwareResponse | null>(null);
  const [venueId,setVenueId]=useState("");
  const [boardId,setBoardId]=useState("");
  const [pin,setPin]=useState("");
  const [name,setName]=useState("Board Display");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!session?.user)return;
    void (async()=>{
      try {const response=await fetch("/api/leagues",{cache:"no-store"});
      if(!response.ok)throw new Error("Could not load leagues.");
      const result=await response.json() as LeagueListResponse;
      const active=localStorage.getItem("dart-scorekeeper:active-league-id");
      setLeagueId(result.leagues.find(x=>x.id===active)?.id ?? result.leagues[0]?.id ?? "");
      }catch(error){setMessage(error instanceof Error?error.message:"Could not load leagues.");}
    })();
  },[session?.user]);
  useEffect(()=>{
    if(!leagueId)return;
    void (async()=>{
      try {const response=await fetch(`/api/leagues/board-devices?leagueId=${encodeURIComponent(leagueId)}`,{cache:"no-store"});
      if(!response.ok)throw new Error("Venue administration access is required.");
      const data=await response.json() as VenueHardwareResponse;
      setHardware(data);setVenueId(data.venue?.id ?? "");setBoardId(data.boards?.[0]?.id ?? "");
      }catch(error){setMessage(error instanceof Error?error.message:"Could not load venue hardware.");}
    })();
  },[leagueId]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/display-enrollment/claim",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin,venueId,physicalBoardId:boardId,name})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw new Error(result.error??"Pairing failed.");
      setMessage("Display paired. Its screen will automatically switch to the assigned board.");
      setPin("");
    }catch(error){setMessage(error instanceof Error?error.message:"Pairing failed.");}
    finally{setBusy(false);}
  }
  if(isPending)return <main className="p-8">Checking account…</main>;
  if(!session?.user)return <main className="p-8">Sign in to pair venue monitors.</main>;
  return <main className="mx-auto max-w-2xl p-6">
    <Link href="/game-nights/control" className="text-sm font-bold">← Game Night Control</Link>
    <h1 className="mt-5 text-3xl font-black">Pair a Board Display</h1>
    <p className="mt-2 text-slate-400">Start the Linux AIO. Enter the six-digit PIN shown on its screen and select the physical board.</p>
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-slate-600 p-6">
      <label className="block font-bold">Display PIN<input aria-label="Display PIN" inputMode="numeric" pattern="[0-9]{6}" required maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,"").slice(0,6))} className="mt-2 w-full rounded-lg bg-slate-900 p-4 text-center font-mono text-3xl tracking-widest"/></label>
      <label className="block font-bold">Display name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-lg bg-slate-900 p-3"/></label>
      <label className="block font-bold">Venue<select value={venueId} onChange={e=>{setVenueId(e.target.value);setBoardId("");}} className="mt-2 w-full rounded-lg bg-slate-900 p-3">{hardware?.venues?.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select></label>
      <label className="block font-bold">Physical board<select required value={boardId} onChange={e=>setBoardId(e.target.value)} className="mt-2 w-full rounded-lg bg-slate-900 p-3">{hardware?.boards?.filter(b=>b.venueId===venueId).map(b=><option key={b.id} value={b.id}>{b.name} (Board {b.boardNumber})</option>)}</select></label>
      <button disabled={busy||pin.length!==6||!boardId} className="w-full rounded-lg bg-emerald-600 p-4 font-black disabled:opacity-50">{busy?"Pairing…":"Pair Display"}</button>
    </form>
    {message&&<p role="status" className="mt-4 rounded-lg border border-slate-600 p-4">{message}</p>}
  </main>;
}
