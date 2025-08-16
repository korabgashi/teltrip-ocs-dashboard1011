import { NextResponse } from "next/server";
import { fetchAllData } from "../../../lib/teltrip";
export const dynamic = "force-dynamic"; export const runtime = "nodejs";
export async function GET(req){
  try{ const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") || undefined;
    const data = await fetchAllData(accountId);
    return NextResponse.json({ok:true,data});
  }catch(err){ return NextResponse.json({ok:false,error:err?.message||"Unknown error"},{status:500}); }
}