import { NextResponse } from "next/server";
import { aiCorsHeaders, checkNineRouterHealth } from "@/lib/nineRouter";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await checkNineRouterHealth({ persistStatus: false });
  return NextResponse.json(
    {
      success: health.connected,
      gatewayUrl: health.baseUrl,
      defaultModel: health.defaultModel,
      count: health.modelsCount,
      models: health.models,
      error: health.error,
    },
    {
      status: health.connected ? 200 : 503,
      headers: aiCorsHeaders(),
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCorsHeaders() });
}
