import { prisma } from "@/lib/prisma";

const DEFAULT_NINE_ROUTER_URL = "http://localhost:20128/v1";
const PROJECT_LABEL = "Purchasing";

const NON_CHAT_MODEL_RE =
  /(?:^|\/)(?:whisper|tts(?:-|$)|dall-e|gpt-image|imagen|sora|veo|text-embedding|embedding|embed-|bge-|rerank|moderation|omni-moderation|transcribe|realtime|audio|.*\/search$|.*\/fetch$)/i;

const PREFERRED_CHAT_MODEL_RE =
  /(?:^|\/)(?:oc\/big-pickle|.*-free$|gpt-4o-mini|gpt-4\.1-mini|gpt-4o|gemini-2\.5-flash|gemini-2\.0-flash|llama-3\.3|llama-3\.1|deepseek-chat|qwen|claude-3-5-haiku|claude-haiku|auto)/i;

const FREE_NO_AUTH_OWNER_SET = new Set(["oc", "ocz", "opencode-go"]);

export type ModelUsableStatus =
  | "verified"
  | "ready"
  | "catalog"
  | "unavailable"
  | "non_chat";

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
  usable?: boolean;
  usableStatus?: ModelUsableStatus;
  connections?: number;
  kind?: string;
  contextLength?: number;
  probeLatencyMs?: number;
  reason?: string;
}

export interface NineRouterHealthResult {
  connected: boolean;
  healthOk: boolean;
  modelsOk: boolean;
  isNineRouter: boolean;
  authVerified: boolean;
  authError?: string;
  rootUrl: string;
  baseUrl: string;
  defaultModel: string;
  recommendedModel: string;
  hasApiKey: boolean;
  isEnabled: boolean;
  modelsCount: number;
  usableCount: number;
  models: NineRouterModelInfo[];
  usableModels: NineRouterModelInfo[];
  latencyMs: number;
  checkedAt: string;
  error?: string;
}

interface RawModelEntry {
  id?: unknown;
  name?: unknown;
  model?: unknown;
  object?: unknown;
  owned_by?: unknown;
  ownedBy?: unknown;
  connections?: unknown;
  kind?: unknown;
  context_length?: unknown;
  capabilities?: {
    contextWindow?: unknown;
  };
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function normalizeNineRouterUrls(rawUrl?: string | null) {
  const fallback = process.env.NINE_ROUTER_URL || DEFAULT_NINE_ROUTER_URL;
  let cleaned =
    (rawUrl || fallback).trim().replace(/\/+$/, "") || DEFAULT_NINE_ROUTER_URL;
  // Strip accidental full endpoint paths if pasted by user
  cleaned = cleaned.replace(/\/(models|chat\/completions)$/i, "");
  const hasKnownApiSuffix = /\/((api\/)?v\d+(?:beta|alpha)?(\/openai)?|openai)$/i.test(
    cleaned
  );
  const rootUrl =
    cleaned.replace(/\/((api\/)?v\d+(?:beta|alpha)?(\/openai)?|openai)$/i, "") ||
    cleaned;
  const apiV1Url = hasKnownApiSuffix ? cleaned : `${cleaned}/v1`;
  return { rootUrl, rawCleanedUrl: cleaned, apiV1Url };
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

async function resolveConnectionParams(override?: {
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}) {
  const saved = await getRawNineRouterConfig();
  const overrideBase = override?.baseUrl?.trim();
  const baseInput = overrideBase || saved.baseUrl;
  const { rootUrl, rawCleanedUrl, apiV1Url } = normalizeNineRouterUrls(baseInput);
  const savedNorm = normalizeNineRouterUrls(saved.baseUrl);
  const isSameSavedEndpoint = !overrideBase || apiV1Url === savedNorm.apiV1Url;

  let apiKey: string | null = null;
  if (override?.clearApiKey) {
    apiKey = null;
  } else if (override?.apiKey !== undefined) {
    const trimmedKey = override.apiKey.trim();
    // Never forward saved API key to a different custom baseUrl unless user enters it
    apiKey = trimmedKey || (isSameSavedEndpoint ? saved.apiKey : null);
  } else {
    apiKey = isSameSavedEndpoint ? saved.apiKey : null;
  }

  return {
    saved,
    rootUrl,
    rawCleanedUrl,
    apiV1Url,
    apiKey,
    isSameSavedEndpoint,
  };
}

function isChatCapableEntry(entry: { id: string; kind?: string }): boolean {
  if (entry.kind && entry.kind !== "llm" && entry.kind !== "imageToText") {
    return false;
  }
  return !NON_CHAT_MODEL_RE.test(entry.id);
}

function isNineRouterFreeNoAuth(entry: NineRouterModelInfo): boolean {
  const owner = (entry.ownedBy || "").toLowerCase();
  if (entry.id === "oc/big-pickle") return true;
  if (FREE_NO_AUTH_OWNER_SET.has(owner) && entry.id.endsWith("-free")) return true;
  return false;
}

function parseModelsPayload(payload: unknown): {
  entries: NineRouterModelInfo[];
  hasRouterMetadata: boolean;
} {
  let rawList: RawModelEntry[] = [];
  if (Array.isArray(payload)) {
    rawList = payload as RawModelEntry[];
  } else if (payload && typeof payload === "object") {
    const obj = payload as { data?: unknown; models?: unknown };
    if (Array.isArray(obj.data)) {
      rawList = obj.data as RawModelEntry[];
    } else if (Array.isArray(obj.models)) {
      rawList = obj.models as RawModelEntry[];
    }
  }

  let hasRouterMetadata = false;
  const seen = new Set<string>();
  const entries: NineRouterModelInfo[] = [];

  for (const m of rawList) {
    const idVal = m?.id ?? m?.name ?? m?.model;
    if (typeof idVal !== "string" || !idVal.trim()) continue;
    const id = idVal.trim();
    if (seen.has(id)) continue;
    seen.add(id);

    const ownedBy =
      typeof m.owned_by === "string"
        ? m.owned_by
        : typeof m.ownedBy === "string"
          ? m.ownedBy
          : undefined;
    const connections =
      typeof m.connections === "number" && Number.isFinite(m.connections)
        ? m.connections
        : undefined;
    const kind = typeof m.kind === "string" ? m.kind : undefined;
    const ctxRaw = m.context_length ?? m.capabilities?.contextWindow;
    const contextLength =
      typeof ctxRaw === "number" && Number.isFinite(ctxRaw) ? ctxRaw : undefined;

    if (
      connections !== undefined ||
      ownedBy === "combo" ||
      ownedBy === "oc" ||
      ownedBy === "ocz" ||
      m.capabilities !== undefined
    ) {
      hasRouterMetadata = true;
    }

    entries.push({
      id,
      object: typeof m.object === "string" ? m.object : "model",
      ownedBy,
      connections,
      kind,
      contextLength,
    });
  }

  return { entries, hasRouterMetadata };
}

async function fetchModelsCatalog(params: {
  apiV1Url: string;
  rawCleanedUrl: string;
  rootUrl: string;
  apiKey: string | null;
}) {
  const candidateUrls: Array<{ url: string; chatBaseUrl: string }> = [
    { url: `${params.apiV1Url}/models`, chatBaseUrl: params.apiV1Url },
  ];
  if (params.rawCleanedUrl !== params.apiV1Url) {
    candidateUrls.push({
      url: `${params.rawCleanedUrl}/models`,
      chatBaseUrl: params.rawCleanedUrl,
    });
  }
  // Support native Ollama endpoint fallback if /v1/models returns 404
  if (`${params.rootUrl}/api/tags` !== `${params.apiV1Url}/models`) {
    candidateUrls.push({
      url: `${params.rootUrl}/api/tags`,
      chatBaseUrl: params.apiV1Url,
    });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`;

  let lastStatus = 0;
  let lastError = "Endpoint model tidak merespons.";

  for (const target of candidateUrls) {
    try {
      const res = await fetch(target.url, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        const errBody = await res.text().catch(() => "");
        return {
          ok: false,
          authFailed: true,
          status: res.status,
          effectiveBaseUrl: target.chatBaseUrl,
          entries: [] as NineRouterModelInfo[],
          hasRouterMetadata: false,
          error: `API Key ditolak oleh ${target.url} (HTTP ${res.status})${
            errBody ? `: ${errBody.slice(0, 120)}` : ""
          }`,
        };
      }

      if (res.ok) {
        const json = (await res.json().catch(() => null)) as unknown;
        const parsed = parseModelsPayload(json);
        return {
          ok: true,
          authFailed: false,
          status: res.status,
          effectiveBaseUrl: target.chatBaseUrl,
          entries: parsed.entries,
          hasRouterMetadata: parsed.hasRouterMetadata,
          error: undefined,
        };
      }

      lastStatus = res.status;
      const errBody = await res.text().catch(() => "");
      lastError = `Endpoint ${target.url} merespons HTTP ${res.status}${
        errBody ? `: ${errBody.slice(0, 120)}` : ""
      }`;
      // Only fall back to alternative paths on 404 / 405
      if (res.status !== 404 && res.status !== 405) {
        break;
      }
    } catch (err: unknown) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      lastError = isTimeout
        ? `Timeout menghubungi ${target.url}`
        : `Tidak dapat menjangkau ${target.url} (${getErrorMessage(err, "offline")})`;
      break;
    }
  }

  return {
    ok: false,
    authFailed: lastStatus === 401 || lastStatus === 403,
    status: lastStatus,
    effectiveBaseUrl: params.apiV1Url,
    entries: [] as NineRouterModelInfo[],
    hasRouterMetadata: false,
    error: lastError,
  };
}

interface ProbeOutcome {
  ok: boolean;
  authError: boolean;
  status: number;
  latencyMs: number;
  error?: string;
}

async function probeChatCandidate(params: {
  baseUrl: string;
  apiKey: string | null;
  modelId: string;
}): Promise<ProbeOutcome> {
  const startedAt = Date.now();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Project-Source": PROJECT_LABEL,
  };
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`;

  const runProbeRequest = async (useMaxCompletionTokens: boolean) => {
    const bodyPayload: Record<string, unknown> = {
      model: params.modelId,
      messages: [{ role: "user", content: "Reply OK" }],
      stream: false,
    };
    if (useMaxCompletionTokens) {
      bodyPayload.max_completion_tokens = 16;
    } else {
      bodyPayload.max_tokens = 16;
    }

    return await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  };

  try {
    let res = await runProbeRequest(false);
    let data = (await res.json().catch(() => null)) as {
      error?: { message?: string; code?: string } | string;
      message?: string;
    } | null;

    if (res.status === 400) {
      const rawErr =
        (typeof data?.error === "object" ? data.error?.message : data?.error) ||
        data?.message ||
        "";
      if (/max_completion_tokens/i.test(String(rawErr))) {
        res = await runProbeRequest(true);
        data = (await res.json().catch(() => null)) as {
          error?: { message?: string; code?: string } | string;
          message?: string;
        } | null;
      }
    }

    const latencyMs = Date.now() - startedAt;
    if (res.ok) {
      return { ok: true, authError: false, status: res.status, latencyMs };
    }

    const upstreamErr =
      (typeof data?.error === "object" ? data.error?.message : data?.error) ||
      data?.message ||
      `HTTP ${res.status}`;
    const errText = String(upstreamErr);
    const authError =
      res.status === 401 ||
      res.status === 403 ||
      /missing api key|invalid api key|invalid_api_key|incorrect api key|unauthorized/i.test(
        errText
      );

    return {
      ok: false,
      authError,
      status: res.status,
      latencyMs,
      error: errText.slice(0, 140),
    };
  } catch (err: unknown) {
    return {
      ok: false,
      authError: false,
      status: 0,
      latencyMs: Date.now() - startedAt,
      error: getErrorMessage(err, "Probe timeout"),
    };
  }
}

function selectProbeCandidates(params: {
  entries: NineRouterModelInfo[];
  isNineRouter: boolean;
  preferredModel?: string;
  limit: number;
}): NineRouterModelInfo[] {
  const chatEntries = params.entries.filter((m) => isChatCapableEntry(m));
  if (chatEntries.length === 0) return [];

  const picked: NineRouterModelInfo[] = [];
  const seenIds = new Set<string>();
  const seenOwners = new Set<string>();

  const tryAdd = (m: NineRouterModelInfo | undefined, requireDistinctOwner: boolean) => {
    if (!m || seenIds.has(m.id)) return false;
    const owner = (m.ownedBy || "default").toLowerCase();
    if (requireDistinctOwner && seenOwners.has(owner)) return false;
    seenIds.add(m.id);
    seenOwners.add(owner);
    picked.push(m);
    return true;
  };

  if (params.preferredModel) {
    const exact = chatEntries.find((m) => m.id === params.preferredModel);
    tryAdd(exact, false);
  }

  const sorted = [...chatEntries].sort((a, b) => {
    if (params.isNineRouter) {
      const aConn = (a.connections ?? 0) > 0 || a.ownedBy === "combo" ? 2 : isNineRouterFreeNoAuth(a) ? 1 : 0;
      const bConn = (b.connections ?? 0) > 0 || b.ownedBy === "combo" ? 2 : isNineRouterFreeNoAuth(b) ? 1 : 0;
      if (aConn !== bConn) return bConn - aConn;
    }
    const aPref = PREFERRED_CHAT_MODEL_RE.test(a.id) ? 1 : 0;
    const bPref = PREFERRED_CHAT_MODEL_RE.test(b.id) ? 1 : 0;
    return bPref - aPref;
  });

  // First pass: distinct providers for broad coverage
  for (const m of sorted) {
    if (picked.length >= params.limit) break;
    tryAdd(m, true);
  }
  // Second pass: fill remaining slots
  for (const m of sorted) {
    if (picked.length >= params.limit) break;
    tryAdd(m, false);
  }

  return picked;
}

export async function checkNineRouterHealth(override?: {
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  model?: string;
  persistStatus?: boolean;
  verifyUsable?: boolean;
}): Promise<NineRouterHealthResult> {
  const startedAt = Date.now();
  const { saved, rootUrl, rawCleanedUrl, apiV1Url, apiKey } =
    await resolveConnectionParams(override);
  const checkedAt = new Date();
  const targetDefaultModel = override?.model?.trim() || saved.defaultModel || "";

  // Check /api/health (only present on 9Router) and /models in parallel; never block /models on /api/health
  const [healthProbe, catalogProbe] = await Promise.all([
    fetch(`${rootUrl}/api/health`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
        return Boolean(json?.ok ?? true);
      })
      .catch(() => false),
    fetchModelsCatalog({
      apiV1Url,
      rawCleanedUrl,
      rootUrl,
      apiKey,
    }),
  ]);

  const healthOk = healthProbe;
  const modelsOk = catalogProbe.ok;
  const effectiveBaseUrl = catalogProbe.effectiveBaseUrl || apiV1Url;
  const isNineRouter =
    healthOk ||
    catalogProbe.hasRouterMetadata ||
    effectiveBaseUrl.includes(":20128");

  let authVerified = !catalogProbe.authFailed;
  let authError: string | undefined = catalogProbe.authFailed
    ? catalogProbe.error
    : undefined;
  let errorMsg: string | undefined = catalogProbe.ok ? undefined : catalogProbe.error;

  const probeOutcomes = new Map<string, ProbeOutcome>();
  const shouldVerifyUsable =
    override?.verifyUsable !== false && modelsOk && catalogProbe.entries.length > 0;

  if (shouldVerifyUsable) {
    const candidates = selectProbeCandidates({
      entries: catalogProbe.entries,
      isNineRouter,
      preferredModel: targetDefaultModel,
      limit: 3,
    });

    if (candidates.length > 0) {
      // Probe first candidate first to verify API Key before sending parallel checks
      const firstCandidate = candidates[0];
      const firstOutcome = await probeChatCandidate({
        baseUrl: effectiveBaseUrl,
        apiKey,
        modelId: firstCandidate.id,
      });
      probeOutcomes.set(firstCandidate.id, firstOutcome);

      if (firstOutcome.authError) {
        authVerified = false;
        authError = `API Key diperlukan atau tidak valid (${firstOutcome.error || `HTTP ${firstOutcome.status}`})`;
        errorMsg = authError;
      } else {
        authVerified = true;
        // Probe remaining diverse candidates in parallel if any (helps detect active vs inactive routes on gateways)
        const remainingCandidates = candidates.slice(1);
        if (
          remainingCandidates.length > 0 &&
          (isNineRouter || !firstOutcome.ok)
        ) {
          const restOutcomes = await Promise.all(
            remainingCandidates.map(async (c) => ({
              id: c.id,
              outcome: await probeChatCandidate({
                baseUrl: effectiveBaseUrl,
                apiKey,
                modelId: c.id,
              }),
            }))
          );
          for (const item of restOutcomes) {
            probeOutcomes.set(item.id, item.outcome);
          }
        }
      }
    }
  }

  const annotatedModels: NineRouterModelInfo[] = catalogProbe.entries.map((entry) => {
    const chatEligible = isChatCapableEntry(entry);
    if (!chatEligible) {
      return {
        ...entry,
        usable: false,
        usableStatus: "non_chat",
        reason: "Bukan model chat/LLM (audio/gambar/embedding/tool)",
      };
    }

    if (!authVerified) {
      return {
        ...entry,
        usable: false,
        usableStatus: "unavailable",
        reason: authError || "API Key belum terverifikasi",
      };
    }

    const probed = probeOutcomes.get(entry.id);
    if (probed) {
      if (probed.ok) {
        return {
          ...entry,
          usable: true,
          usableStatus: "verified",
          probeLatencyMs: probed.latencyMs,
        };
      }
      return {
        ...entry,
        usable: false,
        usableStatus: "unavailable",
        probeLatencyMs: probed.latencyMs,
        reason: probed.error || `HTTP ${probed.status}`,
      };
    }

    if (isNineRouter) {
      const hasLiveConnection = (entry.connections ?? 0) > 0;
      const isLiveCombo = entry.ownedBy === "combo";
      const isFreeNoAuth = isNineRouterFreeNoAuth(entry);
      if (hasLiveConnection || isLiveCombo || isFreeNoAuth) {
        return {
          ...entry,
          usable: true,
          usableStatus: "ready",
        };
      }
      return {
        ...entry,
        usable: false,
        usableStatus: "catalog",
        reason: "Provider belum dihubungkan di Dashboard 9Router",
      };
    }

    // External OpenAI-compatible provider: all chat models exposed for this API Key are ready
    return {
      ...entry,
      usable: true,
      usableStatus: "ready",
    };
  });

  const statusRank: Record<ModelUsableStatus, number> = {
    verified: 0,
    ready: 1,
    catalog: 2,
    unavailable: 3,
    non_chat: 4,
  };

  annotatedModels.sort((a, b) => {
    const rankDiff =
      statusRank[a.usableStatus || "catalog"] -
      statusRank[b.usableStatus || "catalog"];
    if (rankDiff !== 0) return rankDiff;
    const aConn = a.connections ?? 0;
    const bConn = b.connections ?? 0;
    if (aConn !== bConn) return bConn - aConn;
    const aPref = PREFERRED_CHAT_MODEL_RE.test(a.id) ? 1 : 0;
    const bPref = PREFERRED_CHAT_MODEL_RE.test(b.id) ? 1 : 0;
    return bPref - aPref;
  });

  const usableModels = annotatedModels.filter((m) => m.usable);
  const recommendedModel =
    (targetDefaultModel &&
      usableModels.find((m) => m.id === targetDefaultModel)?.id) ||
    usableModels[0]?.id ||
    "";

  const connected = modelsOk;
  const statusTag =
    connected && authVerified && usableModels.length > 0
      ? "CONNECTED"
      : connected
        ? "AUTH_OR_MODEL_ERROR"
        : healthOk
          ? "AUTH_OR_MODEL_ERROR"
          : "OFFLINE";

  if (
    override?.persistStatus !== false &&
    !override?.baseUrl &&
    !override?.clearApiKey
  ) {
    try {
      await prisma.nineRouterConfig.upsert({
        where: { id: "default" },
        update: {
          lastCheckedAt: checkedAt,
          lastStatus: statusTag,
        },
        create: {
          id: "default",
          baseUrl: effectiveBaseUrl,
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
    isNineRouter,
    authVerified,
    authError,
    rootUrl,
    baseUrl: effectiveBaseUrl,
    defaultModel: saved.defaultModel || "",
    recommendedModel,
    hasApiKey: Boolean(apiKey),
    isEnabled: saved.isEnabled,
    modelsCount: annotatedModels.length,
    usableCount: usableModels.length,
    models: annotatedModels,
    usableModels,
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
      error: "Integrasi AI Gateway sedang dinonaktifkan di pengaturan.",
      gatewayUrl: apiV1Url,
    };
  }

  const outboundMessages: Array<{ role: string; content: string }> = [];
  if (Array.isArray(params.messages) && params.messages.length > 0) {
    const cleaned = params.messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role || "user",
        content: m.content,
      }));
    const hasSystem = cleaned.some((m) => m.role === "system");
    if (!hasSystem && params.systemPrompt?.trim()) {
      outboundMessages.push({
        role: "system",
        content: params.systemPrompt.trim(),
      });
    }
    outboundMessages.push(...cleaned);
  } else if (params.prompt?.trim()) {
    if (params.systemPrompt?.trim()) {
      outboundMessages.push({
        role: "system",
        content: params.systemPrompt.trim(),
      });
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
      verifyUsable: false,
    });
    selectedModel =
      probe.recommendedModel ||
      probe.usableModels[0]?.id ||
      probe.models[0]?.id ||
      "auto";
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
        `HTTP ${res.status} dari AI Gateway`;
      const isAuthErr =
        res.status === 401 || /api key/i.test(String(upstreamError));
      return {
        success: false,
        statusCode: res.status,
        model: selectedModel,
        gatewayUrl: apiV1Url,
        error: String(upstreamErrMessage(upstreamError)),
        hint: isAuthErr
          ? `Endpoint AI meminta API Key yang valid. Buka Pengaturan 9Router/AI Gateway dan masukkan API Key lalu pilih model yang terdeteksi.`
          : `Pastikan provider/akun model "${selectedModel}" sudah aktif atau pilih model lain dari daftar Auto-Detect.`,
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
      error: `Gagal terhubung ke AI Gateway (${apiV1Url}): ${getErrorMessage(err, "connection error")}`,
      hint: `Periksa apakah URL Endpoint aktif dan dapat dijangkau (${rootUrl}).`,
    };
  }
}

function upstreamErrMessage(val: unknown): string {
  return String(val || "");
}
