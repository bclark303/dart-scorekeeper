import { getRequestSession } from "@/lib/auth/server";
import { listDisplaysForVenue, updateDisplayForUser } from "@/lib/db/repositories/displayEnrollment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request) {
  const session=await getRequestSession(request);
  if(!session?.user)return json({error:"Authentication required."},401);
  const venueId=new URL(request.url).searchParams.get("venueId")??"";
  try{return json({displays:await listDisplaysForVenue({venueId,userId:session.user.id})});}
  catch{return json({error:"Display administration access denied or unavailable."},403);}
}
export async function PATCH(request:Request) {
  const session=await getRequestSession(request);
  if(!session?.user)return json({error:"Authentication required."},401);
  let input:{id:string;venueId:string;physicalBoardId?:string|null;status?:"active"|"disabled"};
  try{input=await request.json();}catch{return json({error:"Invalid request."},400);}
  if(input.status && !["active","disabled"].includes(input.status))return json({error:"Invalid status."},400);
  try{return json({display:await updateDisplayForUser({...input,userId:session.user.id})});}
  catch{return json({error:"Unable to update display assignment."},400);}
}
