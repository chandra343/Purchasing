import { NextRequest, NextResponse } from "next/server";
import { aiCorsHeaders, checkNineRouterHealth } from "@/lib/nineRouter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const verify = request.nextUrl.searchParams.get("verify") !== "0";
  const health = await checkNineRouterHealth({
    persistStatus: false,
    verifyUsable: verify,
  });
  return NextResponse.json(
    {
      success: health.connected && health.authVerified,
      connected: health.connected,
      authVerified: health.authVerified,
      authError: health.authError,
      isNineRouter: health.isNineRouter,
      gatewayUrl: health.baseUrl,
      defaultModel: health.defaultModel,
      recommendedModel: health.recommendedModel,
      count: health.modelsCount,
      usableCount: health.usableCount,
      models: health.models,
      usableModels: health.usableModels,
      latencyMs: health.latencyMs,
      error: health.error,
    },
    {
      status: health.connected ? (health.authVerified ? 200 : 401) : 503,
      headers: aiCorsHeaders(),
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      baseUrl?: string;
      apiKey?: string;
      clearApiKey?: boolean;
      model?: string;
      verifyUsable?: boolean;
    };
    const health = await checkNineRouterHealth({
      baseUrl: typeof body?.baseUrl === "string" ? body.baseUrl : undefined,
      apiKey: typeof body?.apiKey === "string" ? body.apiKey : undefined,
      clearApiKey: Boolean(body?.clearApiKey),
      model: typeof body?.model === "string" ? body.model : undefined,
      persistStatus: false,
      verifyUsable: body?.verifyUsable !== false,
    });
    return NextResponse.json(
      {
        success: health.connected && health.authVerified,
        ...health,
      },
      {
        status: health.connected ? (health.authVerified ? 200 : 401) : 502,
        headers: aiCorsHeaders(),
      }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        connected: false,
        authVerified: false,
        usableCount: 0,
        usableModels: [],
        models: [],
        error: err instanceof Error ? err.message : "Invalid request payload",
      },
      { status: 400, headers: aiCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCorsHeaders() });
}
