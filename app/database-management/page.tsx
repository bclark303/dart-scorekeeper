"use client";
import Link from "next/link";
import {useState} from "react";
type Profile={id:string;name:string;purpose:"production"|"training"|"testing";provider:"sqlite"|"turso";url:string;hasToken:boolean};
type Profiles={activeId:string|null;profiles:Profile[]};
export default function DatabaseManagementPage(){
 const [token,setToken]=useState("");
 const [result,setResult]=useState<Profiles|null>(null);
 const [name,setName]=useState("Training Database");
 const [purpose,setPurpose]=useState<Profile["purpose"]>("training");
 const [provider,setProvider]=useState<Profile["provider"]>("sqlite");
 const [url,setUrl]=useState("file:/data/dart-scorekeeper-training.db");
 const [secret,setSecret]=useState("");
 const [initialize,setInitialize]=useState(true);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 async function call(action:string,params:Record<string,unknown>={}){
  setBusy(true);setError("");setMessage("");
  try{
   const response=await fetch("/api/setup/database/profiles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,setupToken:token,...params})});
   const payload=await response.json() as Profiles&{error?:string};
   if(!response.ok)throw new Error(payload.error??"Database operation failed.");
   setResult(payload);setSecret("");
   setMessage(action==="add"?"Profile created and connection verified. Select Activate when ready to switch.":action==="activate"?"Active database changed. Sign in again to the selected database.":"Profiles loaded.");
  }catch(e){setError(e instanceof Error?e.message:"Database operation failed.");}finally{setBusy(false);}
 }
 function updateProvider(v:Profile["provider"]){setProvider(v);setUrl(v==="sqlite"?"file:/data/dart-scorekeeper-training.db":"");}
 return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
  <header><Link className="text-sm font-bold text-[var(--color-primary)]" href="/settings">← Settings</Link><h1 className="mt-2 text-3xl font-black">Database Management</h1><p className="text-sm text-[var(--color-text-muted)]">Server administrator only. Profiles switch the entire installation, including users, games, statistics and board pairings.</p></header>
  <section className="rounded-xl border border-amber-500/40 p-4 text-sm"><b>Hosting and safety:</b> Profile switching is currently supported only on persistent self-hosted/Docker installations. Vercel databases must be configured through separate managed environments and deployments. Switching database will invalidate your current application session and may temporarily disconnect displays. Do not switch during a live Game Night.</section>
  <section className="space-y-3 rounded-xl border border-[var(--color-panel-border)] p-5"><h2 className="text-xl font-bold">1. Unlock server administration</h2><label className="block text-sm">Server setup token<input type="password" value={token} onChange={e=>setToken(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-transparent p-3" autoComplete="off"/></label><button type="button" disabled={busy||!token} onClick={()=>void call("list")} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-bold text-white disabled:opacity-50">Load database profiles</button></section>
  {result&&<section className="space-y-3 rounded-xl border border-[var(--color-panel-border)] p-5"><h2 className="text-xl font-bold">2. Existing profiles</h2>{result.profiles.length===0&&<p className="text-sm text-[var(--color-text-muted)]">No profiles saved. The current database configuration is unchanged until you activate a profile.</p>}{result.profiles.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-panel-border)] p-3"><div><div className="font-bold">{p.name} {result.activeId===p.id?"(active)":""}</div><div className="text-xs text-[var(--color-text-muted)]">{p.purpose} · {p.provider} · {p.url}</div></div><button type="button" disabled={busy||result.activeId===p.id} className="rounded-lg border border-[var(--color-panel-border)] px-3 py-2 font-bold disabled:opacity-50" onClick={()=>{if(window.confirm(`Switch the entire app to ${p.name}? Do not switch during live scoring. All accounts and paired devices will come from the selected database.`))void call("activate",{id:p.id});}}>Activate</button></div>)}</section>}
  <section className="space-y-3 rounded-xl border border-[var(--color-panel-border)] p-5"><h2 className="text-xl font-bold">3. Add or initialize a database</h2><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Profile name<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-transparent p-3"/></label><label className="text-sm">Purpose<select value={purpose} onChange={e=>setPurpose(e.target.value as Profile["purpose"])} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-app-bg)] p-3"><option value="training">Training</option><option value="testing">Testing</option><option value="production">Production</option></select></label></div><label className="block text-sm">Database provider<select value={provider} onChange={e=>updateProvider(e.target.value as Profile["provider"])} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-[var(--color-app-bg)] p-3"><option value="sqlite">Local SQLite (creates a local database file)</option><option value="turso">Turso / libSQL (connect to an existing cloud database)</option></select></label><label className="block text-sm">{provider==="sqlite"?"SQLite file URL":"Turso database URL"}<input value={url} onChange={e=>setUrl(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-transparent p-3"/></label>{provider==="turso"&&<label className="block text-sm">Database access token<input type="password" value={secret} onChange={e=>setSecret(e.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-panel-border)] bg-transparent p-3" autoComplete="off"/></label>}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={initialize} onChange={e=>setInitialize(e.target.checked)}/>Initialize/update schema using committed migrations</label><p className="text-xs text-[var(--color-text-muted)]">For Turso, provision the empty cloud database first, then enter its URL and token here. Adding a profile never switches the active database until you press Activate.</p><button type="button" disabled={busy||!token||!name||!url} onClick={()=>void call("add",{profile:{name,purpose,provider,url,authToken:secret,initialize}})} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-bold text-white disabled:opacity-50">Test and save profile</button></section>
  {message&&<p role="status" className="rounded-lg border border-emerald-500/40 p-3 text-sm">{message}</p>}{error&&<p role="alert" className="rounded-lg border border-red-500/40 p-3 text-sm">{error}</p>}
 </main>;
}
