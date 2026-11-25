"use client";

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Layers,
  Plug,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  Wand2,
  X,
} from "lucide-react";
import type { NineRouterHealthResult, NineRouterModelInfo } from "@/lib/nineRouter";

export interface NineRouterConfigState {
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyMasked: string | null;
  defaultModel: string;
  isEnabled: boolean;
  notes: string;
  lastCheckedAt: string | null;
  lastStatus: string | null;
}

interface NineRouterModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectLabel: "Gudang (WMS)" | "Purchasing";
  localPort: number;
  initialConfig?: NineRouterConfigState | null;
  onStatusUpdated?: (status: { connected: boolean; modelsCount?: number }) => void;
  onSaveConfigAction: (data: {
    baseUrl: string;
    apiKey?: string;
    clearApiKey?: boolean;
    defaultModel?: string;
    isEnabled: boolean;
    notes?: string;
  }) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
    config?: NineRouterConfigState;
  }>;
  onTestConnectionAction: (data?: {
    baseUrl?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    model?: string;
    verifyUsable?: boolean;
  }) => Promise<NineRouterHealthResult>;
  onToast?: (type: "success" | "error", msg: string) => void;
}

const ENDPOINT_PRESETS = [
  { label: "9Router Lokal", url: "http://localhost:20128/v1" },
  { label: "OpenRouter", url: "https://openrouter.ai/api/v1" },
  { label: "Groq", url: "https://api.groq.com/openai/v1" },
  { label: "OpenAI", url: "https://api.openai.com/v1" },
  { label: "Ollama", url: "http://localhost:11434/v1" },
] as const;

const subscribeNoop = () => () => {};

function getBrowserHostname() {
  return typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";
}

function resolveBrowserReachableUrl(rawUrl: string | undefined, browserHost: string, fallbackPort: number) {
  const candidate = rawUrl?.trim() || `http://${browserHost}:${fallbackPort}`;
  try {
    const parsed = new URL(candidate);
    const loopbacks = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);
    if (loopbacks.has(parsed.hostname.toLowerCase()) && browserHost && !loopbacks.has(browserHost.toLowerCase())) {
      parsed.hostname = browserHost;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return `http://${browserHost}:${fallbackPort}`;
  }
}

function getErrorMsg(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

function isLikelyValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|(?:\d{1,3}\.){3}\d{1,3}|[a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:\/.*)?$/i.test(
    trimmed
  );
}

function getModelBadge(model: NineRouterModelInfo) {
  switch (model.usableStatus) {
    case "verified":
      return {
        tag: model.probeLatencyMs ? `✓ ${model.probeLatencyMs}ms` : "✓ Aktif",
        cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
      };
    case "ready":
      return {
        tag: (model.connections ?? 0) > 0 ? "★ Connected" : "Siap",
        cls: "bg-violet-100 text-violet-800 border-violet-200",
      };
    case "unavailable":
      return {
        tag: "Error",
        cls: "bg-rose-100 text-rose-800 border-rose-200",
      };
    case "non_chat":
      return {
        tag: "Non-Chat",
        cls: "bg-slate-200 text-slate-600 border-slate-300",
      };
    default:
      return {
        tag: "Katalog",
        cls: "bg-slate-100 text-slate-600 border-slate-200",
      };
  }
}

export default function NineRouterModal({
  isOpen,
  onClose,
  projectLabel,
  localPort,
  initialConfig,
  onStatusUpdated,
  onSaveConfigAction,
  onTestConnectionAction,
  onToast,
}: NineRouterModalProps) {
  const [activeTab, setActiveTab] = useState<"config" | "chat" | "bridge">("config");

  const [savedBaseUrl, setSavedBaseUrl] = useState<string>(
    initialConfig?.baseUrl || "http://localhost:20128/v1"
  );
  const [baseUrlInput, setBaseUrlInput] = useState<string>(
    initialConfig?.baseUrl || "http://localhost:20128/v1"
  );
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [clearApiKey, setClearApiKey] = useState<boolean>(false);
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [hasSavedKey, setHasSavedKey] = useState<boolean>(Boolean(initialConfig?.hasApiKey));
  const [maskedKey, setMaskedKey] = useState<string | null>(initialConfig?.apiKeyMasked || null);
  const [defaultModelInput, setDefaultModelInput] = useState<string>(
    initialConfig?.defaultModel || ""
  );
  const [isEnabledInput, setIsEnabledInput] = useState<boolean>(
    initialConfig?.isEnabled ?? true
  );
  const [notesInput, setNotesInput] = useState<string>(
    initialConfig?.notes || "Terhubung ke 9Router AI Gateway lokal / jaringan."
  );

  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [detectModeLabel, setDetectModeLabel] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [healthInfo, setHealthInfo] = useState<NineRouterHealthResult | null>(null);

  const [modelSearch, setModelSearch] = useState<string>("");
  const [showAllCatalog, setShowAllCatalog] = useState<boolean>(false);

  const [chatModel, setChatModel] = useState<string>(initialConfig?.defaultModel || "");
  const [chatPrompt, setChatPrompt] = useState<string>(
    projectLabel === "Gudang (WMS)"
      ? "Berikan 3 poin singkat checklist QC penerimaan barang masuk di gudang."
      : "Berikan 3 poin tips negosiasi harga bahan baku dengan vendor."
  );
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);
  const [chatResult, setChatResult] = useState<{
    success: boolean;
    reply?: string;
    model?: string;
    error?: string;
    hint?: string;
  } | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const browserHost = useSyncExternalStore(subscribeNoop, getBrowserHostname, () => "localhost");

  const detectSeqRef = useRef<number>(0);
  const lastDetectedSigRef = useRef<string>("");
  const defaultModelRef = useRef<string>(defaultModelInput);
  useEffect(() => {
    defaultModelRef.current = defaultModelInput;
  }, [defaultModelInput]);

  const buildInputSignature = useCallback(
    (url: string, key: string, clearFlag: boolean) =>
      `${url.trim()}|${key.trim()}|${clearFlag ? "1" : "0"}`,
    []
  );

  const runHealthCheck = useCallback(
    async (
      useInputs = true,
      mode: "initial" | "auto" | "manual" = "manual",
      overrideArgs?: { baseUrl?: string; apiKey?: string; clearApiKey?: boolean }
    ) => {
      const effUrl = overrideArgs?.baseUrl ?? baseUrlInput;
      const effKey = overrideArgs?.apiKey ?? apiKeyInput;
      const effClear = overrideArgs?.clearApiKey ?? clearApiKey;
      const sig = buildInputSignature(effUrl, effKey, effClear);
      lastDetectedSigRef.current = sig;

      const seq = ++detectSeqRef.current;
      await Promise.resolve();
      if (seq !== detectSeqRef.current) return;

      setIsChecking(true);
      setDetectModeLabel(
        mode === "auto"
          ? "Auto-detect model dari Base URL & API Key..."
          : "Memeriksa koneksi & model AI bisa digunakan..."
      );

      try {
        const res = await onTestConnectionAction(
          useInputs
            ? {
                baseUrl: effUrl.trim() || undefined,
                apiKey: effKey.trim() || undefined,
                clearApiKey: effClear,
                model: defaultModelRef.current.trim() || undefined,
                verifyUsable: true,
              }
            : { verifyUsable: true }
        );

        if (seq !== detectSeqRef.current) return;

        setHealthInfo(res);
        const usable = Array.isArray(res?.usableModels) ? res.usableModels : [];
        const all = Array.isArray(res?.models) ? res.models : [];

        onStatusUpdated?.({
          connected: Boolean(res?.connected && res?.authVerified && usable.length > 0),
          modelsCount: usable.length || res?.modelsCount || 0,
        });

        const recModel = res?.recommendedModel || usable[0]?.id || "";
        if (recModel) {
          setChatModel((prev) => {
            if (prev && usable.some((m) => m.id === prev)) return prev;
            return recModel;
          });
          setDefaultModelInput((prev) => {
            const trimmed = prev.trim();
            if (!trimmed) return recModel;
            if ((mode === "auto" || mode === "manual") && !all.some((m) => m.id === trimmed)) {
              return recModel;
            }
            return prev;
          });
        }
      } catch (err: unknown) {
        if (seq !== detectSeqRef.current) return;
        setHealthInfo({
          connected: false,
          healthOk: false,
          modelsOk: false,
          isNineRouter: false,
          authVerified: false,
          rootUrl: effUrl,
          baseUrl: effUrl,
          defaultModel: "",
          recommendedModel: "",
          hasApiKey: Boolean(effKey.trim()),
          isEnabled: isEnabledInput,
          modelsCount: 0,
          usableCount: 0,
          models: [],
          usableModels: [],
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
          error: getErrorMsg(err, "Gagal mendeteksi model AI dari endpoint."),
        });
      } finally {
        if (seq === detectSeqRef.current) {
          setIsChecking(false);
          setDetectModeLabel("");
        }
      }
    },
    [
      apiKeyInput,
      baseUrlInput,
      buildInputSignature,
      clearApiKey,
      isEnabledInput,
      onStatusUpdated,
      onTestConnectionAction,
    ]
  );

  // Initial check when modal opens
  useEffect(() => {
    if (!isOpen) {
      lastDetectedSigRef.current = "";
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        void runHealthCheck(false, "initial");
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, runHealthCheck]);

  // Live debounced auto-detect when user types/pastes Base URL or API Key
  useEffect(() => {
    if (!isOpen) return;
    if (!isLikelyValidHttpUrl(baseUrlInput)) return;

    const sig = buildInputSignature(baseUrlInput, apiKeyInput, clearApiKey);
    if (!lastDetectedSigRef.current || sig === lastDetectedSigRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void runHealthCheck(true, "auto");
    }, 650);

    return () => clearTimeout(timer);
  }, [apiKeyInput, baseUrlInput, buildInputSignature, clearApiKey, isOpen, runHealthCheck]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const chosenDefaultModel =
        defaultModelInput.trim() || healthInfo?.recommendedModel || "";
      const res = await onSaveConfigAction({
        baseUrl: baseUrlInput.trim() || "http://localhost:20128/v1",
        apiKey: apiKeyInput.trim() || undefined,
        clearApiKey,
        defaultModel: chosenDefaultModel,
        isEnabled: isEnabledInput,
        notes: notesInput.trim(),
      });
      if (res.success) {
        const nextUrl = res.config?.baseUrl || baseUrlInput.trim();
        if (res.config) {
          setHasSavedKey(res.config.hasApiKey);
          setMaskedKey(res.config.apiKeyMasked);
          setSavedBaseUrl(res.config.baseUrl);
          setBaseUrlInput(res.config.baseUrl);
          setDefaultModelInput(res.config.defaultModel);
        }
        setApiKeyInput("");
        setClearApiKey(false);
        onToast?.("success", res.message || "Konfigurasi AI Gateway berhasil disimpan!");
        await runHealthCheck(true, "manual", {
          baseUrl: nextUrl,
          apiKey: "",
          clearApiKey: false,
        });
      } else {
        onToast?.("error", res.error || "Gagal menyimpan konfigurasi AI Gateway.");
      }
    } catch (err: unknown) {
      onToast?.("error", getErrorMsg(err, "Terjadi kesalahan saat menyimpan."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTestChat = async () => {
    if (!chatPrompt.trim()) return;
    setIsSendingChat(true);
    setChatResult(null);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: chatPrompt,
          model: chatModel.trim() || defaultModelInput.trim() || undefined,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        reply?: string;
        model?: string;
        error?: string;
        hint?: string;
      };
      if (json.success) {
        setChatResult({
          success: true,
          reply: json.reply,
          model: json.model,
        });
      } else {
        setChatResult({
          success: false,
          error: json.error || `HTTP ${res.status}`,
          hint: json.hint,
        });
      }
    } catch (err: unknown) {
      setChatResult({
        success: false,
        error: getErrorMsg(err, "Gagal mengirim tes chat ke /api/ai/chat"),
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const applyModelSelection = (modelId: string, alsoSetDefault = false) => {
    setChatModel(modelId);
    if (alsoSetDefault) {
      setDefaultModelInput(modelId);
    }
  };

  if (!isOpen) return null;

  const routerDashboardLink = resolveBrowserReachableUrl(healthInfo?.rootUrl, browserHost, 20128);
  const bridgeBaseUrl = `http://${browserHost}:${localPort}`;
  const sampleCurlSnippet = `curl -X POST ${bridgeBaseUrl}/api/ai/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Halo dari project baru!",
    "model": "${defaultModelInput || healthInfo?.recommendedModel || "auto"}"
  }'`;

  const hasUnsavedEndpointChanges =
    baseUrlInput.trim() !== savedBaseUrl.trim() ||
    Boolean(apiKeyInput.trim()) ||
    clearApiKey;

  const usableModels = healthInfo?.usableModels || [];
  const allModels = healthInfo?.models || [];
  const isHealthyAndUsable = Boolean(
    healthInfo?.connected && healthInfo?.authVerified && usableModels.length > 0
  );
  const isAuthProblem = Boolean(healthInfo?.connected && !healthInfo?.authVerified);

  const visibleModelSource = showAllCatalog ? allModels : usableModels;
  const searchTerm = modelSearch.trim().toLowerCase();
  const filteredModels = visibleModelSource.filter((m) =>
    !searchTerm ? true : m.id.toLowerCase().includes(searchTerm) || (m.ownedBy || "").toLowerCase().includes(searchTerm)
  );

  const renderEndpointCredentialFields = (options: {
    showPresets: boolean;
    compact: boolean;
  }) => (
    <div className="space-y-2.5">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <label className="block text-xs font-bold text-slate-800">
            Base URL Endpoint AI (OpenAI-Compatible)
          </label>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
            <Wand2 className="w-3 h-3" />
            <span>Auto-Detect Aktif</span>
          </span>
        </div>
        <input
          type="text"
          value={baseUrlInput}
          onChange={(e) => setBaseUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runHealthCheck(true, "manual");
            }
          }}
          placeholder="http://localhost:20128/v1 atau https://api.openai.com/v1"
          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
        />
        {options.showPresets && (
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <span className="text-[10px] text-slate-400">Preset:</span>
            {ENDPOINT_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setBaseUrlInput(preset.url)}
                className={`text-[10px] px-2 py-0.5 rounded-md border cursor-pointer transition ${
                  baseUrlInput.trim() === preset.url
                    ? "bg-violet-600 text-white border-violet-600 font-bold"
                    : "bg-slate-50 hover:bg-violet-50 text-slate-600 border-slate-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold text-slate-800">
            API Key{" "}
            <span className="text-slate-400 font-normal">
              (Otomatis detect model saat diisi)
            </span>
          </label>
          {hasSavedKey &&
            !clearApiKey &&
            baseUrlInput.trim() === savedBaseUrl.trim() && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono">
                Tersimpan: {maskedKey}
              </span>
            )}
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[200px]">
            <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type={showApiKey ? "text" : "password"}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                if (e.target.value) setClearApiKey(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runHealthCheck(true, "manual");
                }
              }}
              placeholder={
                hasSavedKey &&
                !clearApiKey &&
                baseUrlInput.trim() === savedBaseUrl.trim()
                  ? "Tersimpan aman — masukkan key baru jika ingin mengganti"
                  : "Tempel API Key (sk-... / gsk_... / key 9Router)"
              }
              className="w-full pl-9 pr-9 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
              title={showApiKey ? "Sembunyikan" : "Tampilkan"}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void runHealthCheck(true, "manual")}
            disabled={isChecking || !isLikelyValidHttpUrl(baseUrlInput)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 rounded-lg text-xs font-bold cursor-pointer transition disabled:opacity-50 shrink-0"
            title="Deteksi ulang model AI yang bisa digunakan"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
            <span>{options.compact ? "Detect Model" : "Detect Model AI"}</span>
          </button>
          {hasSavedKey && baseUrlInput.trim() === savedBaseUrl.trim() && (
            <button
              type="button"
              onClick={() => {
                setClearApiKey((prev) => !prev);
                setApiKeyInput("");
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer transition shrink-0 ${
                clearApiKey
                  ? "bg-rose-600 text-white border-rose-600"
                  : "bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-300"
              }`}
            >
              {clearApiKey ? "Dihapus" : "Hapus Key"}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150 my-auto max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full">
              <Cpu className="w-3.5 h-3.5" />
              9Router & AI Auto-Detect
            </span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {projectLabel} • Port {localPort}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Pengaturan AI Gateway & Auto-Detect Model
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Masukkan Base URL & API Key untuk langsung mendeteksi model AI yang siap digunakan.
          </p>
        </div>

        {/* Status Bar Real-Time */}
        <div
          className={`mb-4 rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${
            isHealthyAndUsable
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : isAuthProblem
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs">
            {isHealthyAndUsable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : isAuthProblem ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold flex items-center gap-2 flex-wrap">
                <span>
                  {isChecking
                    ? detectModeLabel || "Mendeteksi model AI yang bisa digunakan..."
                    : isHealthyAndUsable
                      ? `${usableModels.length} Model AI Bisa Digunakan${
                          healthInfo && healthInfo.modelsCount > usableModels.length
                            ? ` (dari ${healthInfo.modelsCount} katalog)`
                            : ""
                        }`
                      : isAuthProblem
                        ? "API Key Diperlukan atau Tidak Valid"
                        : healthInfo?.connected
                          ? `Terhubung, 0 Model Siap Pakai (${healthInfo.modelsCount} katalog belum aktif)`
                          : "Endpoint AI Belum Terhubung / Perlu Dicek"}
                </span>
                {healthInfo?.latencyMs !== undefined && !isChecking && (
                  <span className="text-[10px] font-mono bg-white/80 px-1.5 py-0.5 rounded border border-current/15">
                    {healthInfo.latencyMs}ms
                  </span>
                )}
              </div>
              {!isChecking && (healthInfo?.authError || (healthInfo?.error && !isHealthyAndUsable)) && (
                <p className="text-[11px] opacity-90 mt-0.5">
                  {healthInfo.authError || healthInfo.error}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void runHealthCheck(true, "manual")}
              disabled={isChecking}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-[11px] font-bold cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
              <span>Detect Ulang</span>
            </button>
            {(healthInfo?.isNineRouter ?? true) && (
              <a
                href={routerDashboardLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[11px] font-bold transition"
              >
                <span>Buka 9Router</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "config"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plug className="w-3.5 h-3.5" />
            <span>Pengaturan & API Key</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "chat"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Model & Tes Chat</span>
            {usableModels.length > 0 && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                {usableModels.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bridge")}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === "bridge"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>API Bridge Project Lain</span>
          </button>
        </div>

        {/* TAB 1: CONFIG */}
        {activeTab === "config" && (
          <div className="space-y-4">
            {renderEndpointCredentialFields({ showPresets: true, compact: false })}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-800">
                  Default Model AI ({usableModels.length} Terdeteksi Bisa Digunakan)
                </label>
                {healthInfo?.recommendedModel && (
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultModelInput(healthInfo.recommendedModel);
                      setChatModel(healthInfo.recommendedModel);
                    }}
                    className="text-[10px] font-bold text-violet-700 hover:text-violet-900 cursor-pointer"
                  >
                    Pakai Rekomendasi: {healthInfo.recommendedModel}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={defaultModelInput}
                  onChange={(e) => setDefaultModelInput(e.target.value)}
                  placeholder="Otomatis terisi dari hasil Auto-Detect, atau ketik ID model"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
                />
                {allModels.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        applyModelSelection(e.target.value, true);
                      }
                    }}
                    className="max-w-[230px] px-2.5 py-2 bg-violet-50 border border-violet-200 text-violet-900 rounded-lg text-xs font-semibold outline-none cursor-pointer"
                  >
                    <option value="">
                      -- Pilih ({usableModels.length} Siap Pakai) --
                    </option>
                    {usableModels.length > 0 && (
                      <optgroup label={`Bisa Digunakan (${usableModels.length})`}>
                        {usableModels.map((m) => (
                          <option key={`u-${m.id}`} value={m.id}>
                            {m.usableStatus === "verified" ? "✓ " : ""}
                            {m.id}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {allModels.length > usableModels.length && (
                      <optgroup
                        label={`Katalog Lain (${allModels.length - usableModels.length})`}
                      >
                        {allModels
                          .filter((m) => !m.usable)
                          .slice(0, 120)
                          .map((m) => (
                            <option key={`c-${m.id}`} value={m.id}>
                              {m.id}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Quick chips of usable models right in Config tab */}
              {usableModels.length > 0 && (
                <div className="mt-2 bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-2.5">
                  <div className="text-[11px] font-bold text-emerald-900 mb-1.5 flex items-center justify-between">
                    <span>Model AI yang Terdeteksi Siap Digunakan:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("chat")}
                      className="text-[10px] text-violet-700 hover:underline cursor-pointer"
                    >
                      Lihat Semua & Tes Chat →
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {usableModels.slice(0, 18).map((m) => {
                      const badge = getModelBadge(m);
                      const isSelected = defaultModelInput === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => applyModelSelection(m.id, true)}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md border cursor-pointer transition ${
                            isSelected
                              ? "bg-violet-600 text-white border-violet-600 font-bold"
                              : "bg-white hover:bg-emerald-50 text-slate-800 border-slate-200"
                          }`}
                        >
                          <span>{m.id}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded border ${
                              isSelected
                                ? "bg-white/20 text-white border-white/25"
                                : badge.cls
                            }`}
                          >
                            {badge.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Catatan Integrasi
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Contoh: Digunakan untuk sinkronisasi AI Gudang, Purchasing & Project Baru"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={isEnabledInput}
                onChange={(e) => setIsEnabledInput(e.target.checked)}
                className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
              />
              <span className="text-xs font-semibold text-slate-800">
                Aktifkan Bridge API <code>/api/ai/*</code> & Integrasi AI Gateway
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? "Menyimpan..." : "Simpan & Verifikasi"}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MODELS (AUTO-DETECT + TEST CHAT) */}
        {activeTab === "chat" && (
          <div className="space-y-4">
            {/* Base URL & API Key synced directly in Model Tab for immediate Auto-Detect */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
              {renderEndpointCredentialFields({ showPresets: false, compact: true })}

              {hasUnsavedEndpointChanges && (
                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200 text-[11px]">
                  <span className="text-amber-800 font-medium">
                    Endpoint / API Key diubah (belum disimpan ke database).
                  </span>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white rounded-md font-bold cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isSaving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Detected Usable Models List */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-violet-600" />
                  <span>
                    {showAllCatalog
                      ? `Semua Model Katalog (${allModels.length})`
                      : `Model AI Bisa Digunakan (${usableModels.length})`}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {allModels.length > usableModels.length && (
                    <button
                      type="button"
                      onClick={() => setShowAllCatalog((v) => !v)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-violet-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md cursor-pointer"
                    >
                      {showAllCatalog
                        ? `Hanya Siap Pakai (${usableModels.length})`
                        : `Semua Katalog (${allModels.length})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void runHealthCheck(true, "manual")}
                    disabled={isChecking}
                    className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
                    <span>Detect</span>
                  </button>
                </div>
              </div>

              {visibleModelSource.length > 6 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Cari nama model AI..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-violet-400 outline-none"
                  />
                </div>
              )}

              {filteredModels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  {filteredModels.slice(0, 60).map((m) => {
                    const badge = getModelBadge(m);
                    const isSelected = chatModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => applyModelSelection(m.id, false)}
                        title={m.reason || (m.usable ? "Siap digunakan" : "Belum siap")}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md border cursor-pointer transition ${
                          isSelected
                            ? "bg-violet-600 text-white border-violet-600 font-bold"
                            : m.usable
                              ? "bg-white hover:bg-violet-50 text-slate-800 border-slate-200"
                              : "bg-slate-100/80 text-slate-500 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        <span>{m.id}</span>
                        <span
                          className={`text-[9px] px-1 rounded border ${
                            isSelected
                              ? "bg-white/20 text-white border-white/25"
                              : badge.cls
                          }`}
                        >
                          {badge.tag}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  {isChecking
                    ? "Sedang memindai model AI yang bisa digunakan..."
                    : isAuthProblem
                      ? healthInfo?.authError ||
                        "API Key diperlukan atau salah — masukkan API Key yang valid di atas untuk mendeteksi model."
                      : "Belum ada model AI aktif terdeteksi untuk Base URL & API Key ini. Coba masukkan API Key aktif atau hubungkan provider di 9Router."}
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Model Uji Coba
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={chatModel}
                      onChange={(e) => setChatModel(e.target.value)}
                      placeholder={defaultModelInput || healthInfo?.recommendedModel || "auto / id model"}
                      className="flex-1 px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                    {chatModel.trim() && chatModel.trim() !== defaultModelInput.trim() && (
                      <button
                        type="button"
                        onClick={() => setDefaultModelInput(chatModel.trim())}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer whitespace-nowrap"
                      >
                        Jadikan Default
                      </button>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-1 flex items-end gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      setChatPrompt(
                        projectLabel === "Gudang (WMS)"
                          ? "Buatkan checklist singkat penerimaan PO barang fisik di gudang."
                          : "Buatkan template pesan singkat follow-up status pengiriman PO ke vendor."
                      )
                    }
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-2 rounded-lg cursor-pointer"
                  >
                    Preset
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChatPrompt("Jawab singkat dengan 1 kalimat: Koneksi AI berhasil!")
                    }
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-2 rounded-lg cursor-pointer"
                  >
                    Tes Ping AI
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Prompt Tes Chat (/api/ai/chat)
                </label>
                <textarea
                  rows={3}
                  value={chatPrompt}
                  onChange={(e) => setChatPrompt(e.target.value)}
                  placeholder="Ketik pesan pengujian..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                {hasUnsavedEndpointChanges ? (
                  <span className="text-[11px] text-amber-700">
                    Klik <b>Simpan Pengaturan</b> terlebih dahulu sebelum tes chat pada endpoint baru.
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={handleSendTestChat}
                  disabled={isSendingChat || !chatPrompt.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingChat ? "Mengirim..." : "Kirim Tes Chat"}</span>
                </button>
              </div>
            </div>

            {chatResult && (
              <div
                className={`rounded-xl p-3.5 border text-xs ${
                  chatResult.success
                    ? "bg-emerald-50 border-emerald-200 text-slate-800"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    {chatResult.success
                      ? `Balasan AI (${chatResult.model || "AI Gateway"})`
                      : "Gagal Mendapatkan Balasan AI"}
                  </span>
                </div>
                {chatResult.success ? (
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700 bg-white/80 p-2.5 rounded-lg border border-emerald-100 max-h-48 overflow-y-auto">
                    {chatResult.reply || "(Respons kosong)"}
                  </pre>
                ) : (
                  <div className="space-y-1 text-[11px]">
                    <p className="font-semibold">{chatResult.error}</p>
                    {chatResult.hint && <p className="opacity-85">{chatResult.hint}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: API BRIDGE DOCS FOR FUTURE PROJECTS */}
        {activeTab === "bridge" && (
          <div className="space-y-3 text-xs">
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3.5 text-violet-950">
              <p className="font-bold mb-1">Siap Dihubungkan ke Project Berikutnya!</p>
              <p className="text-[11px] text-violet-800 leading-relaxed">
                Project baru Anda dapat terhubung langsung ke <b>9Router Gateway</b> maupun memakai endpoint bridge <b>{projectLabel}</b> di bawah ini (termasuk auto-detect model via <code>POST /api/ai/models</code>).
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: "gateway",
                  label: "1. Central 9Router OpenAI-Compatible Endpoint",
                  url: `http://${browserHost}:20128/v1`,
                },
                {
                  id: "status",
                  label: `2. Cek Status & Koneksi AI (${projectLabel})`,
                  url: `GET ${bridgeBaseUrl}/api/ai/status`,
                },
                {
                  id: "models",
                  label: `3. Auto-Detect Model Bisa Digunakan (${projectLabel})`,
                  url: `POST ${bridgeBaseUrl}/api/ai/models`,
                },
                {
                  id: "chat",
                  label: `4. Endpoint Chat / Inferensi AI (${projectLabel})`,
                  url: `POST ${bridgeBaseUrl}/api/ai/chat`,
                },
              ].map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-700">{ep.label}</p>
                    <p className="text-[11px] font-mono text-slate-600 truncate">{ep.url}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(ep.id, ep.url)}
                    className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-md cursor-pointer shrink-0"
                    title="Salin Endpoint"
                  >
                    {copiedId === ep.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700">
                  Contoh Pemanggilan dari Project Baru (cURL / HTTP POST):
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy("curl", sampleCurlSnippet)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-900 cursor-pointer"
                >
                  {copiedId === "curl" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === "curl" ? "Tersalin!" : "Salin Snippet"}</span>
                </button>
              </div>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed">
                {sampleCurlSnippet}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
