"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Cpu,
  MessageSquare,
  Palette,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import type { DashboardBgPreset } from "@/lib/dashboardPrefs";

export interface ChatbotDashboardAction {
  type: "UPDATE_PREFS" | "RESET_DEFAULT" | "OPEN_CUSTOMIZER";
  patch?: {
    bgPreset?: DashboardBgPreset;
    bgCustomColor?: string;
    bgOverlayOpacity?: number;
    themeColor?: string;
    compactTable?: boolean;
    showBanner?: boolean;
    showStats?: boolean;
    showFilterPanel?: boolean;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  isError?: boolean;
  hint?: string;
  appliedActionLabel?: string;
  suggestBackgroundActions?: boolean;
}

interface NineRouterChatbotProps {
  projectLabel: "Gudang (WMS)" | "Purchasing";
  isConnected: boolean;
  defaultModel?: string;
  contextSummary: string;
  quickPrompts: string[];
  currentPrefs?: {
    bgPreset?: DashboardBgPreset;
    themeColor?: string;
  };
  onOpenSettings: () => void;
  onApplyDashboardAction?: (
    action: ChatbotDashboardAction
  ) => Promise<{ success: boolean; message?: string }>;
}

const VALID_BG_PRESETS = new Set<DashboardBgPreset>([
  "default",
  "dark",
  "ocean",
  "emerald",
  "violet",
  "sunset",
  "custom",
]);
const VALID_THEME_COLORS = new Set(["indigo", "emerald", "slate", "violet"]);

const QUICK_BG_CHIPS: Array<{ label: string; action: ChatbotDashboardAction }> = [
  { label: "Gelap", action: { type: "UPDATE_PREFS", patch: { bgPreset: "dark" } } },
  { label: "Biru", action: { type: "UPDATE_PREFS", patch: { bgPreset: "ocean" } } },
  { label: "Hijau", action: { type: "UPDATE_PREFS", patch: { bgPreset: "emerald" } } },
  { label: "Ungu", action: { type: "UPDATE_PREFS", patch: { bgPreset: "violet" } } },
  { label: "Upload Gambar...", action: { type: "OPEN_CUSTOMIZER" } },
  { label: "Reset Default", action: { type: "RESET_DEFAULT" } },
];

function sanitizeParsedAction(raw: unknown): ChatbotDashboardAction | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { type?: unknown; patch?: unknown };
  const rawType = typeof obj.type === "string" ? obj.type.toUpperCase() : "";

  if (rawType === "RESET_DEFAULT" || rawType === "RESTORE_DEFAULT") {
    return { type: "RESET_DEFAULT" };
  }
  if (rawType === "OPEN_CUSTOMIZER" || rawType === "OPEN_BACKGROUND_MODAL") {
    return { type: "OPEN_CUSTOMIZER" };
  }
  if (rawType === "UPDATE_PREFS" || rawType === "UPDATE_DASHBOARD") {
    const p =
      obj.patch && typeof obj.patch === "object"
        ? (obj.patch as Record<string, unknown>)
        : {};
    const patch: NonNullable<ChatbotDashboardAction["patch"]> = {};
    if (
      typeof p.bgPreset === "string" &&
      VALID_BG_PRESETS.has(p.bgPreset as DashboardBgPreset)
    ) {
      patch.bgPreset = p.bgPreset as DashboardBgPreset;
    }
    if (
      typeof p.bgCustomColor === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(p.bgCustomColor.trim())
    ) {
      patch.bgCustomColor = p.bgCustomColor.trim().toLowerCase();
      if (!patch.bgPreset) patch.bgPreset = "custom";
    }
    if (
      typeof p.bgOverlayOpacity === "number" &&
      Number.isFinite(p.bgOverlayOpacity)
    ) {
      patch.bgOverlayOpacity = Math.min(
        85,
        Math.max(0, Math.round(p.bgOverlayOpacity))
      );
    }
    if (typeof p.themeColor === "string" && VALID_THEME_COLORS.has(p.themeColor)) {
      patch.themeColor = p.themeColor;
    }
    if (typeof p.compactTable === "boolean") patch.compactTable = p.compactTable;
    if (typeof p.showBanner === "boolean") patch.showBanner = p.showBanner;
    if (typeof p.showStats === "boolean") patch.showStats = p.showStats;
    if (typeof p.showFilterPanel === "boolean") patch.showFilterPanel = p.showFilterPanel;

    if (Object.keys(patch).length > 0) {
      return { type: "UPDATE_PREFS", patch };
    }
  }
  return null;
}

function extractAppActionFromReply(replyText: string): {
  cleanedReply: string;
  action: ChatbotDashboardAction | null;
} {
  let action: ChatbotDashboardAction | null = null;
  const cleanedReply = replyText
    .replace(/\[APP_ACTION\]([\s\S]*?)\[\/APP_ACTION\]/gi, (_, jsonBody: string) => {
      try {
        const candidate = sanitizeParsedAction(JSON.parse(jsonBody.trim()));
        if (candidate) action = candidate;
      } catch {
        // ignore malformed JSON tag
      }
      return "";
    })
    .trim();

  return { cleanedReply, action };
}

function inferDashboardActionFromConversation(
  userText: string,
  history: ChatMessage[]
): { action: ChatbotDashboardAction | null; isBgTopic: boolean } {
  const lower = userText.toLowerCase();
  const isBgMentioned =
    /\b(background|backgroud|latar|wallpaper|tema|dark mode|mode gelap|tampilan)\b/i.test(
      lower
    );
  const recentContextText = history
    .slice(-4)
    .map((m) => m.content.toLowerCase())
    .join(" ");
  const prevWasBgTopic =
    /\b(background|backgroud|latar|wallpaper|tema|kustom|bg-panel)\b/i.test(
      recentContextText
    );
  const isApplyCommand =
    /\b(terapkan|apply|aktifkan|pasang|jalankan|gunakan|pakai|ganti|ubah|reset|restore|default)\b/i.test(
      lower
    );

  const isBgTopic = isBgMentioned || (prevWasBgTopic && isApplyCommand);
  if (!isBgTopic) return { action: null, isBgTopic: false };

  if (/\b(reset|restore|default|semula|kembali)\b/i.test(lower)) {
    return { action: { type: "RESET_DEFAULT" }, isBgTopic: true };
  }

  const hexMatch = userText.match(/#[0-9a-fA-F]{6}\b/);
  if (hexMatch) {
    return {
      action: {
        type: "UPDATE_PREFS",
        patch: { bgPreset: "custom", bgCustomColor: hexMatch[0].toLowerCase() },
      },
      isBgTopic: true,
    };
  }

  if (/\b(gelap|dark|night|hitam)\b/i.test(lower)) {
    return { action: { type: "UPDATE_PREFS", patch: { bgPreset: "dark" } }, isBgTopic: true };
  }
  if (/\b(biru|blue|ocean|samudra|laut)\b/i.test(lower)) {
    return { action: { type: "UPDATE_PREFS", patch: { bgPreset: "ocean" } }, isBgTopic: true };
  }
  if (/\b(hijau|green|emerald|zamrud)\b/i.test(lower)) {
    return {
      action: { type: "UPDATE_PREFS", patch: { bgPreset: "emerald" } },
      isBgTopic: true,
    };
  }
  if (/\b(ungu|violet|purple)\b/i.test(lower)) {
    return { action: { type: "UPDATE_PREFS", patch: { bgPreset: "violet" } }, isBgTopic: true };
  }
  if (/\b(senja|sunset|oranye|orange|hangat|hanget)\b/i.test(lower)) {
    return { action: { type: "UPDATE_PREFS", patch: { bgPreset: "sunset" } }, isBgTopic: true };
  }
  if (/\b(terang|light|putih|cerah)\b/i.test(lower)) {
    return {
      action: { type: "UPDATE_PREFS", patch: { bgPreset: "default" } },
      isBgTopic: true,
    };
  }

  if (isApplyCommand || /\b(upload|gambar|foto|custom)\b/i.test(lower)) {
    return { action: { type: "OPEN_CUSTOMIZER" }, isBgTopic: true };
  }

  return { action: null, isBgTopic: true };
}

export default function NineRouterChatbot({
  projectLabel,
  isConnected,
  defaultModel,
  contextSummary,
  quickPrompts,
  currentPrefs,
  onOpenSettings,
  onApplyDashboardAction,
}: NineRouterChatbotProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel || "");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const msgSeqRef = useRef<number>(0);

  const nextMsgId = (prefix: string) => {
    msgSeqRef.current += 1;
    return `${prefix}-${msgSeqRef.current}`;
  };

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch("/api/ai/models?verify=0")
      .then((r) => r.json())
      .then(
        (d: {
          defaultModel?: string;
          recommendedModel?: string;
          usableModels?: Array<{ id?: string }>;
          models?: Array<{ id?: string }>;
        }) => {
          if (!active) return;
          const source =
            Array.isArray(d?.usableModels) && d.usableModels.length > 0
              ? d.usableModels
              : Array.isArray(d?.models)
                ? d.models
                : [];
          const ids = source
            .map((m) => m.id)
            .filter((id): id is string => Boolean(id));
          setAvailableModels(ids.slice(0, 60));
          setSelectedModel((prev) => {
            if (prev && ids.includes(prev)) return prev;
            if (d.defaultModel) return d.defaultModel;
            if (d.recommendedModel) return d.recommendedModel;
            return ids[0] || prev || "";
          });
        }
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isOpen, defaultModel, isConnected]);

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isSending]);

  const executeDashboardAction = async (
    action: ChatbotDashboardAction
  ): Promise<{ success: boolean; message?: string }> => {
    if (!onApplyDashboardAction) {
      return { success: false, message: "Aksi dashboard belum tersedia." };
    }
    return await onApplyDashboardAction(action);
  };

  const handleChipAction = async (label: string, action: ChatbotDashboardAction) => {
    const res = await executeDashboardAction(action);
    if (res.success) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId("sys"),
          role: "assistant",
          content: res.message || `Pengaturan "${label}" berhasil diterapkan ke dashboard Anda.`,
          appliedActionLabel: res.message || `Diterapkan: ${label}`,
        },
      ]);
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? inputValue).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: nextMsgId("u"),
      role: "user",
      content: text,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!textOverride) setInputValue("");
    setIsSending(true);

    try {
      const systemPrompt = [
        `Anda adalah Asisten AI resmi untuk sistem ${projectLabel}.`,
        "INFORMASI ARSITEKTUR NYATA (WAJIB DIPATUHI):",
        `- Aplikasi ini SUDAH dibangun menggunakan Next.js 16 + React 19 + Tailwind CSS + Prisma/SQLite (BUKAN HTML statis, Vue, atau Laravel).`,
        "- DILARANG menanyakan framework atau stack aplikasi, dan DILARANG menulis tutorial HTML/CSS/JS mentah.",
        "- Fitur ganti background & personalisasi dashboard per akun ID Card SUDAH TERSEDIA di aplikasi ini (termasuk preset terang/gelap/samudra biru/hijau zamrud/ungu/senja, warna hex kustom, upload gambar JPG/PNG/WebP + slider overlay, dan Restore Default).",
        `Preferensi user saat ini: bgPreset=${currentPrefs?.bgPreset || "default"}, themeColor=${currentPrefs?.themeColor || "default"}.`,
        "",
        "KEMAMPUAN EKSEKUSI LANGSUNG KE DASHBOARD:",
        "Anda dapat LANGSUNG mengubah tampilan/background dashboard user dengan menyertakan TEPAT 1 blok tag berikut di akhir balasan Anda:",
        '1. Ubah background preset: [APP_ACTION]{"type":"UPDATE_PREFS","patch":{"bgPreset":"dark"}}[/APP_ACTION] (nilai valid bgPreset: "default", "dark", "ocean", "emerald", "violet", "sunset")',
        '2. Ubah background warna hex: [APP_ACTION]{"type":"UPDATE_PREFS","patch":{"bgPreset":"custom","bgCustomColor":"#1e293b"}}[/APP_ACTION]',
        '3. Ubah tema banner: [APP_ACTION]{"type":"UPDATE_PREFS","patch":{"themeColor":"emerald"}}[/APP_ACTION]',
        '4. Buka panel Upload Gambar & Pengaturan Background lengkap: [APP_ACTION]{"type":"OPEN_CUSTOMIZER"}[/APP_ACTION]',
        '5. Restore/Reset tampilan ke default: [APP_ACTION]{"type":"RESET_DEFAULT"}[/APP_ACTION]',
        "",
        "ATURAN BALASAN:",
        "- Jawab dalam Bahasa Indonesia yang ringkas dan jelas.",
        '- Jika user ingin mengganti background/tema/tampilan atau mengetik "terapkan"/"pakai"/"pasang" terkait background/tampilan, SERTAKAN tag [APP_ACTION]...[/APP_ACTION] agar langsung diterapkan ke layar user.',
        "- Jika user meminta penambahan modul/fitur coding baru di luar stok/PO/personalisasi tampilan (yang butuh edit kode server & skema Prisma), sampaikan dengan jujur batasannya dan jangan mengarang kode HTML tempelan.",
        "",
        "DATA REALTIME PROJECT SAAT INI:",
        contextSummary,
      ].join("\n");

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt,
          model: selectedModel.trim() || defaultModel || undefined,
          messages: nextHistory
            .filter((m) => !m.isError)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reply?: string;
        model?: string;
        error?: string;
        hint?: string;
      };

      if (data.success) {
        const rawReply = data.reply || "(Tidak ada balasan)";
        const { cleanedReply, action: llmAction } = extractAppActionFromReply(rawReply);
        const inferred = inferDashboardActionFromConversation(text, messages);
        const effectiveAction = llmAction || inferred.action;

        let appliedActionLabel: string | undefined;
        if (effectiveAction && onApplyDashboardAction) {
          const applied = await executeDashboardAction(effectiveAction);
          if (applied.success) {
            appliedActionLabel =
              applied.message ||
              (effectiveAction.type === "OPEN_CUSTOMIZER"
                ? "Panel Pengaturan Background & Tampilan dibuka"
                : effectiveAction.type === "RESET_DEFAULT"
                  ? "Tampilan dikembalikan ke Default"
                  : "Perubahan background/tampilan diterapkan");
          }
        }

        // Prevent confusing raw HTML/tutorial dumps if model still tried emitting HTML despite background action
        const containsRawHtmlSnippet = /```html|<div\s+id=["']bg-panel|document\.documentElement/i.test(
          cleanedReply
        );
        const finalContent =
          containsRawHtmlSnippet && appliedActionLabel
            ? `${appliedActionLabel}. Anda juga dapat memilih warna atau mengunggah gambar background langsung melalui tombol cepat di bawah ini atau menu "Atur Tampilan".`
            : cleanedReply || appliedActionLabel || rawReply;

        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId("a"),
            role: "assistant",
            content: finalContent,
            model: data.model,
            appliedActionLabel,
            suggestBackgroundActions: Boolean(
              inferred.isBgTopic || effectiveAction
            ),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId("e"),
            role: "assistant",
            content: data.error || `HTTP ${res.status}`,
            hint: data.hint,
            isError: true,
          },
        ]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungi server AI";
      setMessages((prev) => [
        ...prev,
        {
          id: nextMsgId("e"),
          role: "assistant",
          content: msg,
          hint: "Pastikan server AI / 9Router dan bridge API /api/ai/chat aktif.",
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95 border border-white/20"
        title={`Buka Asisten AI ${projectLabel} (9Router)`}
      >
        <div className="relative flex items-center justify-center">
          <MessageSquare className="w-5 h-5" />
          <span
            className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ring-2 ring-indigo-600 ${
              isConnected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
        </div>
        <span className="text-xs font-bold tracking-wide whitespace-nowrap">
          Chat AI
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2rem)] sm:w-[400px] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[560px]">
      {/* Header Chatbot */}
      <div className="bg-gradient-to-r from-violet-700 to-indigo-700 text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold truncate">Asisten {projectLabel}</span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isConnected ? "bg-emerald-400" : "bg-amber-300"
                }`}
                title={isConnected ? "AI Gateway Terhubung" : "Perlu cek koneksi AI"}
              />
            </div>
            <p className="text-[10px] text-violet-100/90 flex items-center gap-1 truncate">
              <Cpu className="w-3 h-3 shrink-0" />
              <span className="truncate">{selectedModel || "9Router Auto"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMessages([])}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/85 hover:text-white cursor-pointer transition"
            title="Bersihkan percakapan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/85 hover:text-white cursor-pointer transition"
            title="Pengaturan Base URL, API Key & Auto-Detect Model AI"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/85 hover:text-white cursor-pointer transition"
            title="Tutup Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selector Model Ringkas */}
      {availableModels.length > 0 && (
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">
            Model Aktif:
          </span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-md px-2 py-1 text-[11px] font-mono text-slate-700 outline-none focus:border-violet-400 cursor-pointer"
          >
            <option value="">Otomatis (Default)</option>
            {availableModels.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Body Percakapan */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-slate-50/60 min-h-[260px]">
        {messages.length === 0 ? (
          <div className="space-y-3 py-2">
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600 leading-relaxed shadow-2xs">
              <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                <span>Terhubung ke AI Gateway &amp; Kontrol Dashboard</span>
              </div>
              Tanyakan data <b>{projectLabel}</b> atau minta langsung ganti background/tema dashboard Anda (misal: &ldquo;ganti background gelap&rdquo;).
            </div>

            <div className="space-y-1.5">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => void sendMessage(q)}
                  className="w-full text-left text-[11px] font-medium bg-white hover:bg-violet-50 text-slate-700 hover:text-violet-800 border border-slate-200 hover:border-violet-300 px-3 py-2 rounded-xl transition cursor-pointer shadow-2xs"
                >
                  {q}
                </button>
              ))}
              {onApplyDashboardAction && (
                <button
                  type="button"
                  onClick={() =>
                    void handleChipAction("Panel Background", { type: "OPEN_CUSTOMIZER" })
                  }
                  className="w-full text-left text-[11px] font-semibold bg-indigo-50/80 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Palette className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ganti Background &amp; Tema Dashboard Pribadi</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : m.isError
                      ? "bg-rose-50 border border-rose-200 text-rose-900 rounded-bl-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>

                {m.appliedActionLabel && (
                  <div className="mt-2 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{m.appliedActionLabel}</span>
                  </div>
                )}

                {m.suggestBackgroundActions && onApplyDashboardAction && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {QUICK_BG_CHIPS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => void handleChipAction(chip.label, chip.action)}
                        className="text-[10px] font-semibold bg-slate-100 hover:bg-violet-100 text-slate-700 hover:text-violet-800 border border-slate-200 px-2 py-1 rounded-md cursor-pointer transition"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {m.hint && (
                  <div className="mt-2 pt-2 border-t border-rose-200/70 text-[11px] text-rose-800 space-y-1.5">
                    <p>{m.hint}</p>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Buka Pengaturan &amp; Detect Model</span>
                    </button>
                  </div>
                )}

                {m.model && !m.isError && (
                  <div className="mt-1.5 text-[9px] text-slate-400 font-mono">
                    via {m.model}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-violet-500 animate-bounce" />
              <span>Sedang memproses...</span>
            </div>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage();
        }}
        className="p-2.5 bg-white border-t border-slate-200 flex items-end gap-2 shrink-0"
      >
        <textarea
          rows={1}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Tanya AI atau ketik 'ganti background gelap'..."
          className="flex-1 resize-none bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-violet-500 outline-none max-h-24"
        />
        <button
          type="submit"
          disabled={isSending || !inputValue.trim()}
          className="p-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl cursor-pointer transition disabled:opacity-40 shrink-0 shadow-xs"
          title="Kirim Pesan"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
