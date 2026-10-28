import { getRequestSession } from "@/lib/auth/server";
import { abandonVenueMatch, listActiveVenueMatches } from "@/lib/db/repositories/venueActiveMatches";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
  const session=await getRequestSession(request);
  if(!session?.user)return json({error:"Sign in required."},401);
  const venueId=new URL(request.url).searchParams.get("venueId")??"";
  try{return json({matches:await listActiveVenueMatches({venueId,userId:session.user.id})});}
  catch{return json({error:"Unable to list active matches for this venue."},403);}
}
export async function POST(request:Request){
  const session=await getRequestSession(request);
  if(!session?.user)return json({error:"Sign in required."},401);
  let input:{venueId:string;matchId:string;action:string};
  try{input=await request.json();}catch{return json({error:"Invalid request."},400);}
  if(input.action!=="abandon"||!input.venueId||!input.matchId)return json({error:"Invalid request."},400);
  try{return json(await abandonVenueMatch({...input,userId:session.user.id}));}
  catch(error){return json({error:error instanceof Error?error.message:"Cannot end match."},409);}
}
