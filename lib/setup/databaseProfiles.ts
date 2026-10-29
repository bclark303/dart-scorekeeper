import { chmodSync, existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { getRuntimeConfigPath, isSelfHostedRuntime, verifySetupToken, writeRuntimeConfig } from "@/lib/db/runtimeConfig";
import { resetDatabaseConnection } from "@/lib/db/client";
import { resetAuth } from "@/lib/auth/server";
import { migrateLibSqlSetupConnection, testLibSqlSetupConnection } from "@/lib/db/adapters/libsqlSetup";

type Profile = { id:string; name:string; purpose:"production"|"training"|"testing"; provider:"sqlite"|"turso"; url:string; authToken?:string; createdAt:number };
type Store = {version:1;activeId:string|null;profiles:Profile[]};
const EMPTY:Store={version:1,activeId:null,profiles:[]};
function requireAdmin(token?:string) {
  if(!isSelfHostedRuntime()) throw new Error("This deployment is managed by the hosting platform. Use a separate Vercel environment/deployment for each database.");
  if(!verifySetupToken(token))throw new Error("Invalid server setup token.");
}
function storePath() {
  const base=getRuntimeConfigPath();
  if(!base)throw new Error("Persistent server configuration is not available.");
  return base+".database-profiles";
}
function read():Store {
  const p=storePath();
  if(!existsSync(p))return {...EMPTY,profiles:[]};
  const s=JSON.parse(readFileSync(p,"utf8")) as Store;
  if(s.version!==1||!Array.isArray(s.profiles))throw new Error("Invalid database profile store.");
  return s;
}
function write(store:Store) {
  const file=storePath();
  const temp=file+".tmp";
  writeFileSync(temp,JSON.stringify(store,null,2),{mode:0o600});
  chmodSync(temp,0o600);
  // atomic replacement on the same filesystem
  renameSync(temp,file);
}
function publicProfiles(store:Store) {
  return {activeId:store.activeId,profiles:store.profiles.map(({authToken,...p})=>({...p,hasToken:Boolean(authToken)}))};
}
export function listProfiles(token?:string) {requireAdmin(token);return publicProfiles(read());}
export async function addProfile(input:{name:string;purpose:Profile["purpose"];provider:Profile["provider"];url:string;authToken?:string;initialize?:boolean},token?:string) {
  requireAdmin(token);
  const name=input.name?.trim();
  if(!name||name.length>80)throw new Error("Profile name must contain 1–80 characters.");
  if(!["production","training","testing"].includes(input.purpose))throw new Error("Invalid purpose.");
  if(!["sqlite","turso"].includes(input.provider))throw new Error("Unsupported provider.");
  const url=input.url?.trim();
  if(input.provider==="sqlite" && (!url?.startsWith("file:")||url.includes("..")||url==="file:"))throw new Error("A safe SQLite file: URL is required.");
  if(input.provider==="turso"&&!/^((libsql|https):\/\/)/.test(url))throw new Error("A Turso libsql:// or https:// URL is required.");
  const authToken=input.authToken?.trim()||undefined;
  const store=read();
  if(store.profiles.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw new Error("Profile names must be unique.");
  const conn={url,authToken};
  if(input.initialize)await migrateLibSqlSetupConnection(conn);
  else await testLibSqlSetupConnection(conn);
  store.profiles.push({id:crypto.randomUUID(),name,purpose:input.purpose,provider:input.provider,url,authToken,createdAt:Date.now()});
  write(store);
  return publicProfiles(store);
}
export async function activateProfile(id:string,token?:string) {
  requireAdmin(token);
  const store=read();
  const profile=store.profiles.find(p=>p.id===id);
  if(!profile)throw new Error("Profile not found.");
  await testLibSqlSetupConnection({url:profile.url,authToken:profile.authToken});
  // Migration is explicit at creation; never silently mutate a previously used database when switching.
  writeRuntimeConfig({provider:"libsql",displayProvider:profile.provider,url:profile.url,authToken:profile.authToken});
  store.activeId=id;write(store);
  resetDatabaseConnection();resetAuth();
  return publicProfiles(store);
}
