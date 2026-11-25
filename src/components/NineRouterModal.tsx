"use client";

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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
  Send,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import type { NineRouterHealthResult } from "@/lib/nineRouter";

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

interface ModelItem {
  id: string;
  ownedBy?: string;
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
  }) => Promise<NineRouterHealthResult>;
  onToast?: (type: "success" | "error", msg: string) => void;
}

const subscribeNoop = () => () => {};

function getBrowserHostname() {
  return typeof window !== "undefined" ? window.location.hostname || "localhost" : "localhost";
}

function getErrorMsg(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
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
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [healthInfo, setHealthInfo] = useState<{
    connected: boolean;
    healthOk?: boolean;
    modelsOk?: boolean;
    modelsCount: number;
    models: ModelItem[];
    latencyMs?: number;
    rootUrl?: string;
    error?: string;
  } | null>(null);

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

  const runHealthCheck = useCallback(
    async (useInputs = false) => {
      await Promise.resolve();
      setIsChecking(true);
      try {
        const res = await onTestConnectionAction(
          useInputs
            ? {
                baseUrl: baseUrlInput,
                apiKey: apiKeyInput.trim() || undefined,
              }
            : undefined
        );
        const modelsList = Array.isArray(res?.models) ? res.models : [];
        setHealthInfo({
          connected: Boolean(res?.connected),
          healthOk: res?.healthOk,
          modelsOk: res?.modelsOk,
          modelsCount: res?.modelsCount || 0,
          models: modelsList,
          latencyMs: res?.latencyMs,
          rootUrl: res?.rootUrl,
          error: res?.error,
        });
        onStatusUpdated?.({
          connected: Boolean(res?.connected),
          modelsCount: res?.modelsCount || 0,
        });
        setChatModel((prev) => prev || defaultModelInput || modelsList[0]?.id || "");
      } catch (err: unknown) {
        setHealthInfo({
          connected: false,
          modelsCount: 0,
          models: [],
          error: getErrorMsg(err, "Gagal mengecek koneksi ke 9Router."),
        });
      } finally {
        setIsChecking(false);
      }
    },
    [apiKeyInput, baseUrlInput, defaultModelInput, onStatusUpdated, onTestConnectionAction]
  );

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        void runHealthCheck(false);
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, runHealthCheck]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await onSaveConfigAction({
        baseUrl: baseUrlInput.trim() || "http://localhost:20128/v1",
        apiKey: apiKeyInput.trim() || undefined,
        clearApiKey,
        defaultModel: defaultModelInput.trim(),
        isEnabled: isEnabledInput,
        notes: notesInput.trim(),
      });
      if (res.success) {
        if (res.config) {
          setHasSavedKey(res.config.hasApiKey);
          setMaskedKey(res.config.apiKeyMasked);
          setBaseUrlInput(res.config.baseUrl);
          setDefaultModelInput(res.config.defaultModel);
        }
        setApiKeyInput("");
        setClearApiKey(false);
        onToast?.("success", res.message || "Konfigurasi 9Router berhasil disimpan!");
        await runHealthCheck(false);
      } else {
        onToast?.("error", res.error || "Gagal menyimpan konfigurasi 9Router.");
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

  if (!isOpen) return null;

  const routerDashboardLink = `http://${browserHost}:20128`;
  const bridgeBaseUrl = `http://${browserHost}:${localPort}`;
  const sampleCurlSnippet = `curl -X POST ${bridgeBaseUrl}/api/ai/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Halo dari project baru!",
    "model": "${defaultModelInput || "auto"}"
  }'`;

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
              9Router AI Gateway
            </span>
            <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {projectLabel} • Port {localPort}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Integrasi & Bridge 9Router AI Gateway
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Hubungkan {projectLabel} dengan 9Router (Port 20128) sebagai pusat AI Gateway dan API Bridge untuk project selanjutnya.
          </p>
        </div>

        {/* Status Bar Real-Time */}
        <div
          className={`mb-4 rounded-xl p-3 border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 ${
            healthInfo?.connected
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex items-start gap-2.5 text-xs">
            {healthInfo?.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold flex items-center gap-2 flex-wrap">
                <span>
                  {isChecking
                    ? "Memeriksa koneksi 9Router..."
                    : healthInfo?.connected
                      ? `Terhubung ke 9Router (${healthInfo.modelsCount} model terdeteksi)`
                      : "9Router Belum Terhubung / Perlu Dicek"}
                </span>
                {healthInfo?.latencyMs !== undefined && !isChecking && (
                  <span className="text-[10px] font-mono bg-white/80 px-1.5 py-0.5 rounded border border-current/15">
                    {healthInfo.latencyMs}ms
                  </span>
                )}
              </div>
              {healthInfo?.error && !healthInfo.connected && (
                <p className="text-[11px] opacity-85 mt-0.5">{healthInfo.error}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => runHealthCheck(true)}
              disabled={isChecking}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg text-[11px] font-bold cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
              <span>Cek Koneksi</span>
            </button>
            <a
              href={routerDashboardLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-[11px] font-bold transition"
            >
              <span>Buka 9Router</span>
              <ExternalLink className="w-3 h-3" />
            </a>
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
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  URL Endpoint 9Router (OpenAI-Compatible)
                </label>
                <input
                  type="text"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  placeholder="http://localhost:20128/v1"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Default lokal: <code>http://localhost:20128/v1</code> (mendukung juga IP LAN server).
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    API Key 9Router <span className="text-slate-400 font-normal">(Opsional jika REQUIRE_API_KEY=false)</span>
                  </label>
                  {hasSavedKey && !clearApiKey && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full font-mono">
                      Tersimpan: {maskedKey}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={apiKeyInput}
                      onChange={(e) => {
                        setApiKeyInput(e.target.value);
                        if (e.target.value) setClearApiKey(false);
                      }}
                      placeholder={
                        hasSavedKey && !clearApiKey
                          ? "Tersimpan aman — masukkan key baru hanya jika ingin mengganti"
                          : "Tempel API Key dari Dashboard 9Router → Keys"
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
                  {hasSavedKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setClearApiKey((prev) => !prev);
                        setApiKeyInput("");
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer transition ${
                        clearApiKey
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-300"
                      }`}
                    >
                      {clearApiKey ? "Akan Dihapus" : "Hapus Key"}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Default Model / Combo ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={defaultModelInput}
                    onChange={(e) => setDefaultModelInput(e.target.value)}
                    placeholder="Kosongkan untuk pilih otomatis, atau pilih dari model tersedia"
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none transition"
                  />
                  {healthInfo && healthInfo.models.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          setDefaultModelInput(e.target.value);
                          setChatModel(e.target.value);
                        }
                      }}
                      className="max-w-[200px] px-2.5 py-2 bg-violet-50 border border-violet-200 text-violet-900 rounded-lg text-xs font-semibold outline-none cursor-pointer"
                    >
                      <option value="">-- Pilih dari {healthInfo.modelsCount} Model --</option>
                      {healthInfo.models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
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
                  Aktifkan Bridge API <code>/api/ai/*</code> & Integrasi 9Router
                </span>
              </label>
            </div>

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

        {/* TAB 2: MODELS & TEST CHAT */}
        {activeTab === "chat" && (
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-violet-600" />
                  Daftar Model dari 9Router ({healthInfo?.modelsCount || 0})
                </span>
                <button
                  type="button"
                  onClick={() => runHealthCheck(false)}
                  disabled={isChecking}
                  className="text-[11px] font-semibold text-violet-700 hover:text-violet-900 cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isChecking ? "animate-spin" : ""}`} />
                  Refresh Model
                </button>
              </div>
              {healthInfo && healthInfo.models.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {healthInfo.models.slice(0, 40).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChatModel(m.id)}
                      className={`text-[11px] font-mono px-2 py-1 rounded-md border cursor-pointer transition ${
                        chatModel === m.id
                          ? "bg-violet-600 text-white border-violet-600 font-bold"
                          : "bg-white hover:bg-violet-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      {m.id}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Belum ada model terdeteksi atau Anda belum menghubungkan provider AI di Dashboard 9Router ({routerDashboardLink}).
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Model Uji Coba
                  </label>
                  <input
                    type="text"
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    placeholder={defaultModelInput || "auto / id model"}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      setChatPrompt(
                        projectLabel === "Gudang (WMS)"
                          ? "Buatkan checklist singkat penerimaan PO barang fisik di gudang."
                          : "Buatkan template pesan singkat follow-up status pengiriman PO ke vendor."
                      )
                    }
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    Preset 1
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setChatPrompt("Jawab singkat dengan 1 kalimat: Koneksi 9Router berhasil!")
                    }
                    className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer"
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
                  placeholder="Ketik pesan pengujian untuk dikirim ke 9Router..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSendTestChat}
                  disabled={isSendingChat || !chatPrompt.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingChat ? "Mengirim ke 9Router..." : "Kirim Tes Chat"}</span>
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
                      ? `Balasan AI (${chatResult.model || "9Router"})`
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
              <p className="font-bold mb-1">
                Siap Dihubungkan ke Project Berikutnya!
              </p>
              <p className="text-[11px] text-violet-800 leading-relaxed">
                Project baru Anda dapat terhubung langsung ke <b>9Router Gateway</b> (format OpenAI) ataupun melalui endpoint bridge <b>{projectLabel}</b> di bawah ini (sudah mendukung CORS).
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
                  label: `3. Daftar Model Tersedia (${projectLabel})`,
                  url: `GET ${bridgeBaseUrl}/api/ai/models`,
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
