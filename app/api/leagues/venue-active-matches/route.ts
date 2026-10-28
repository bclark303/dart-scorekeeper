import { getRequestSession } from "@/lib/auth/server";
import { abandonVenueMatch, listActiveVenueMatches, listActiveBoardAllocations, releaseVenueBoardAllocation } from "@/lib/db/repositories/venueActiveMatches";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
  const session=await getRequestSession(request);
  if(!session?.user)return json({error:"Sign in required."},401);
  const venueId=new URL(request.url).searchParams.get("venueId")??"";
  try{return json({matches:await listActiveVenueMatches({venueId,userId:session.user.id}),allocations:await listActiveBoardAllocations({venueId,userId:session.user.id})});}
  catch{return json({error:"Unable to list active matches for this venue."},403);}
}
export async function POST(request:Request){
  const session=await getRequestSession(request);
  if(!session?.user)return json({error:"Sign in required."},401);
  let input:{venueId:string;matchId?:string;slotId?:string;action:string};
  try{input=await request.json();}catch{return json({error:"Invalid request."},400);}
  if(!input.venueId)return json({error:"Venue is required."},400);
  if(input.action==="release"&&input.slotId){try{return json(await releaseVenueBoardAllocation({venueId:input.venueId,slotId:input.slotId,userId:session.user.id}));}catch(error){return json({error:error instanceof Error?error.message:"Cannot release board."},409);}}
  if(input.action!=="abandon"||!input.matchId)return json({error:"Invalid request."},400);
  try{return json(await abandonVenueMatch({...input,userId:session.user.id}));}
  catch(error){return json({error:error instanceof Error?error.message:"Cannot end match."},409);}
}
