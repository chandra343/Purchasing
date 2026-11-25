import { NextRequest, NextResponse } from "next/server";
import { aiCorsHeaders, sendNineRouterChat } from "@/lib/nineRouter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await sendNineRouterChat({
      prompt: body?.prompt,
      systemPrompt: body?.systemPrompt,
      messages: body?.messages,
      model: body?.model,
      temperature: body?.temperature,
      maxTokens: body?.maxTokens ?? body?.max_tokens,
    });

    return NextResponse.json(result, {
      status: result.statusCode || (result.success ? 200 : 500),
      headers: aiCorsHeaders(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid JSON request body";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400, headers: aiCorsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCorsHeaders() });
}
