"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  Cpu,
  MessageSquare,
  RotateCcw,
  Send,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  isError?: boolean;
  hint?: string;
}

interface NineRouterChatbotProps {
  projectLabel: "Gudang (WMS)" | "Purchasing";
  isConnected: boolean;
  defaultModel?: string;
  contextSummary: string;
  quickPrompts: string[];
  onOpenSettings: () => void;
}

export default function NineRouterChatbot({
  projectLabel,
  isConnected,
  defaultModel,
  contextSummary,
  quickPrompts,
  onOpenSettings,
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
        "Jawablah dalam bahasa Indonesia yang ringkas, jelas, dan membantu berdasarkan data project berikut.",
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
        setMessages((prev) => [
          ...prev,
          {
            id: nextMsgId("a"),
            role: "assistant",
            content: data.reply || "(Tidak ada balasan)",
            model: data.model,
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
    <div className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2rem)] sm:w-[390px] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden max-h-[540px]">
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
                <span>Terhubung ke AI Gateway</span>
              </div>
              Tanyakan apa saja mengenai data <b>{projectLabel}</b> secara langsung atau pilih pertanyaan cepat di bawah:
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
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : m.isError
                      ? "bg-rose-50 border border-rose-200 text-rose-900 rounded-bl-sm"
                      : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
                {m.hint && (
                  <div className="mt-2 pt-2 border-t border-rose-200/70 text-[11px] text-rose-800 space-y-1.5">
                    <p>{m.hint}</p>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded-lg text-[10px] cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Buka Pengaturan & Detect Model</span>
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
          placeholder="Tanya AI..."
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
