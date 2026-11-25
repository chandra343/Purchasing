import { prisma } from "@/lib/prisma";

const DEFAULT_NINE_ROUTER_URL = "http://localhost:20128/v1";
const PROJECT_LABEL = "Purchasing";

export interface NineRouterConfigDto {
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  defaultModel: string;
  isEnabled: boolean;
  notes: string;
  lastCheckedAt: string | null;
  lastStatus: string | null;
}

export interface NineRouterModelInfo {
  id: string;
  object?: string;
  ownedBy?: string;
}

export interface NineRouterHealthResult {
  connected: boolean;
  healthOk: boolean;
  modelsOk: boolean;
  rootUrl: string;
  baseUrl: string;
  defaultModel: string;
  hasApiKey: boolean;
  isEnabled: boolean;
  modelsCount: number;
  models: NineRouterModelInfo[];
  latencyMs: number;
  checkedAt: string;
  error?: string;
}

interface RawModelEntry {
  id?: unknown;
  object?: unknown;
  owned_by?: unknown;
  ownedBy?: unknown;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function normalizeNineRouterUrls(rawUrl?: string | null) {
  const fallback = process.env.NINE_ROUTER_URL || DEFAULT_NINE_ROUTER_URL;
  const cleaned = (rawUrl || fallback).trim().replace(/\/+$/, "") || DEFAULT_NINE_ROUTER_URL;
  const rootUrl = cleaned.replace(/\/(api\/)?v1$/i, "");
  const apiV1Url = /\/(api\/)?v1$/i.test(cleaned) ? cleaned : `${rootUrl}/v1`;
  return { rootUrl, apiV1Url };
}

export function maskApiKey(key?: string | null): string | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 5)}••••${trimmed.slice(-4)}`;
}

export function aiCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Project-Source",
    "Cache-Control": "no-store, max-age=0",
  };
}

export async function getRawNineRouterConfig() {
  const row = await prisma.nineRouterConfig.findUnique({
    where: { id: "default" },
  });

  const envUrl = process.env.NINE_ROUTER_URL || DEFAULT_NINE_ROUTER_URL;
  const envKey = process.env.NINE_ROUTER_API_KEY?.trim() || "";

  if (!row) {
    return {
      id: "default",
      baseUrl: normalizeNineRouterUrls(envUrl).apiV1Url,
      apiKey: envKey || null,
      defaultModel: "",
      isEnabled: true,
      notes: "Terhubung ke 9Router AI Gateway lokal / jaringan.",
      lastCheckedAt: null as Date | null,
      lastStatus: null as string | null,
    };
  }

  return {
    ...row,
    baseUrl: normalizeNineRouterUrls(row.baseUrl).apiV1Url,
    apiKey: row.apiKey?.trim() || envKey || null,
    defaultModel: row.defaultModel || "",
    notes: row.notes || "",
  };
}

export async function getNineRouterConfigDto(): Promise<NineRouterConfigDto> {
  const raw = await getRawNineRouterConfig();
  return {
    baseUrl: raw.baseUrl,
    hasApiKey: Boolean(raw.apiKey),
    apiKeyMasked: maskApiKey(raw.apiKey),
    defaultModel: raw.defaultModel || "",
    isEnabled: raw.isEnabled,
    notes: raw.notes || "",
    lastCheckedAt: raw.lastCheckedAt ? raw.lastCheckedAt.toISOString() : null,
    lastStatus: raw.lastStatus || null,
  };
}

async function resolveConnectionParams(override?: { baseUrl?: string; apiKey?: string }) {
  const saved = await getRawNineRouterConfig();
  const baseInput = override?.baseUrl?.trim() ? override.baseUrl.trim() : saved.baseUrl;
  const { rootUrl, apiV1Url } = normalizeNineRouterUrls(baseInput);
  const apiKey =
    override?.apiKey !== undefined
      ? override.apiKey.trim() || saved.apiKey
      : saved.apiKey;
  return { saved, rootUrl, apiV1Url, apiKey };
}

export async function checkNineRouterHealth(override?: {
  baseUrl?: string;
  apiKey?: string;
  persistStatus?: boolean;
}): Promise<NineRouterHealthResult> {
  const startedAt = Date.now();
  const { saved, rootUrl, apiV1Url, apiKey } = await resolveConnectionParams(override);
  const checkedAt = new Date();

  let healthOk = false;
  let modelsOk = false;
  let models: NineRouterModelInfo[] = [];
  let errorMsg: string | undefined;

  try {
    const healthRes = await fetch(`${rootUrl}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (healthRes.ok) {
      const json = (await healthRes.json().catch(() => ({}))) as { ok?: boolean };
      healthOk = Boolean(json?.ok ?? true);
    } else {
      errorMsg = `Health check HTTP ${healthRes.status}`;
    }
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    errorMsg = isTimeout
      ? `Timeout menghubungi ${rootUrl}`
      : `Tidak dapat menjangkau ${rootUrl} (${getErrorMessage(err, "offline")})`;
  }

  if (healthOk) {
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const modelsRes = await fetch(`${apiV1Url}/models`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      });

      if (modelsRes.ok) {
        const data = (await modelsRes.json().catch(() => ({}))) as
          | { data?: RawModelEntry[] }
          | RawModelEntry[];
        const rawList: RawModelEntry[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : [];
        models = rawList
          .filter((m) => Boolean(m?.id))
          .map((m) => ({
            id: String(m.id),
            object: typeof m.object === "string" ? m.object : "model",
            ownedBy:
              typeof m.owned_by === "string"
                ? m.owned_by
                : typeof m.ownedBy === "string"
                  ? m.ownedBy
                  : "9router",
          }));
        modelsOk = true;
      } else {
        const errBody = await modelsRes.text().catch(() => "");
        errorMsg = `Endpoint /v1/models merespons HTTP ${modelsRes.status}${
          modelsRes.status === 401 ? " (API Key 9Router diperlukan atau tidak valid)" : ""
        }${errBody ? `: ${errBody.slice(0, 120)}` : ""}`;
      }
    } catch (err: unknown) {
      errorMsg = `Gagal mengambil daftar model dari ${apiV1Url}/models: ${getErrorMessage(err, "timeout")}`;
    }
  }

  const connected = healthOk && modelsOk;
  const statusTag = connected ? "CONNECTED" : healthOk ? "AUTH_OR_MODEL_ERROR" : "OFFLINE";

  if (override?.persistStatus !== false && !override?.baseUrl) {
    try {
      await prisma.nineRouterConfig.upsert({
        where: { id: "default" },
        update: {
          lastCheckedAt: checkedAt,
          lastStatus: statusTag,
        },
        create: {
          id: "default",
          baseUrl: apiV1Url,
          apiKey: saved.apiKey,
          defaultModel: saved.defaultModel || null,
          isEnabled: saved.isEnabled,
          notes: saved.notes || null,
          lastCheckedAt: checkedAt,
          lastStatus: statusTag,
        },
      });
    } catch {
      // Abaikan jika DB sedang terkunci
    }
  }

  return {
    connected,
    healthOk,
    modelsOk,
    rootUrl,
    baseUrl: apiV1Url,
    defaultModel: saved.defaultModel || "",
    hasApiKey: Boolean(apiKey),
    isEnabled: saved.isEnabled,
    modelsCount: models.length,
    models,
    latencyMs: Date.now() - startedAt,
    checkedAt: checkedAt.toISOString(),
    error: errorMsg,
  };
}

export async function sendNineRouterChat(params: {
  prompt?: string;
  systemPrompt?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  apiKey?: string;
}) {
  const { saved, rootUrl, apiV1Url, apiKey } = await resolveConnectionParams({
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
  });

  if (!saved.isEnabled && !params.baseUrl) {
    return {
      success: false,
      statusCode: 503,
      error: "Integrasi 9Router AI Gateway sedang dinonaktifkan di pengaturan.",
      gatewayUrl: apiV1Url,
    };
  }

  let outboundMessages: Array<{ role: string; content: string }> = [];
  if (Array.isArray(params.messages) && params.messages.length > 0) {
    outboundMessages = params.messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role || "user",
        content: m.content,
      }));
  } else if (params.prompt?.trim()) {
    if (params.systemPrompt?.trim()) {
      outboundMessages.push({ role: "system", content: params.systemPrompt.trim() });
    }
    outboundMessages.push({ role: "user", content: params.prompt.trim() });
  }

  if (outboundMessages.length === 0) {
    return {
      success: false,
      statusCode: 400,
      error: "Parameter `prompt` atau `messages` wajib diisi.",
      gatewayUrl: apiV1Url,
    };
  }

  let selectedModel = params.model?.trim() || saved.defaultModel?.trim() || "";
  if (!selectedModel) {
    const probe = await checkNineRouterHealth({
      baseUrl: apiV1Url,
      apiKey: apiKey || undefined,
      persistStatus: false,
    });
    selectedModel = probe.models[0]?.id || "auto";
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Project-Source": PROJECT_LABEL,
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(`${apiV1Url}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: selectedModel,
        messages: outboundMessages,
        stream: false,
        temperature: params.temperature ?? 0.7,
        ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      }),
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });

    const data = (await res.json().catch(() => null)) as {
      error?: { message?: string } | string;
      message?: string;
      model?: string;
      usage?: Record<string, unknown>;
      output_text?: string;
      choices?: Array<{ message?: { content?: string }; text?: string }>;
    } | null;

    if (!res.ok) {
      const upstreamError =
        (typeof data?.error === "object" ? data.error?.message : data?.error) ||
        data?.message ||
        `HTTP ${res.status} dari 9Router`;
      return {
        success: false,
        statusCode: res.status,
        model: selectedModel,
        gatewayUrl: apiV1Url,
        error: String(upstreamError),
        hint: `Pastikan provider/akun model "${selectedModel}" sudah terhubung dan aktif di Dashboard 9Router (${rootUrl}).`,
      };
    }

    const reply =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.output_text ??
      "";

    return {
      success: true,
      statusCode: 200,
      project: PROJECT_LABEL,
      model: data?.model || selectedModel,
      reply: String(reply),
      usage: data?.usage || null,
      gatewayUrl: apiV1Url,
      raw: data,
    };
  } catch (err: unknown) {
    return {
      success: false,
      statusCode: 502,
      model: selectedModel,
      gatewayUrl: apiV1Url,
      error: `Gagal terhubung ke 9Router (${apiV1Url}): ${getErrorMessage(err, "connection error")}`,
      hint: `Periksa apakah server 9Router berjalan di ${rootUrl} (jalankan \`pnpm router:dev\`).`,
    };
  }
}
