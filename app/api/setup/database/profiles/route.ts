import { activateProfile, addProfile, listProfiles } from "@/lib/setup/databaseProfiles";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const response=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
  try{
    const data=await request.json() as {action:string;setupToken?:string;id?:string;profile?:Parameters<typeof addProfile>[0]};
    if(data.action==="list")return response(listProfiles(data.setupToken));
    if(data.action==="add"&&data.profile)return response(await addProfile(data.profile,data.setupToken));
    if(data.action==="activate"&&data.id)return response(await activateProfile(data.id,data.setupToken));
    return response({error:"Invalid database management action."},400);
  }catch(error){return response({error:error instanceof Error?error.message:"Database operation failed."},400);}
}
