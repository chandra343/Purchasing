"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  LayoutDashboard,
  Palette,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  BACKGROUND_PRESET_OPTIONS,
  DashboardBgPreset,
  PURCHASING_STAT_LABELS,
  PurchasingDashboardPrefs,
  PurchasingStatKey,
  PurchasingTabKey,
  PurchasingThemeColor,
  isPurchasingPrefsCustomized,
} from "@/lib/dashboardPrefs";

interface DashboardCustomizerModalProps {
  userName: string;
  userIdCard: string;
  currentPrefs: PurchasingDashboardPrefs;
  onClose: () => void;
  onSave: (prefs: PurchasingDashboardPrefs) => Promise<boolean>;
  onResetDefault: () => Promise<boolean>;
}

const THEME_OPTIONS: Array<{ key: PurchasingThemeColor; label: string; dotClass: string }> = [
  { key: "emerald", label: "Emerald (Bawaan)", dotClass: "bg-emerald-600" },
  { key: "indigo", label: "Indigo", dotClass: "bg-indigo-600" },
  { key: "slate", label: "Slate Netral", dotClass: "bg-slate-700" },
  { key: "violet", label: "Violet AI", dotClass: "bg-violet-600" },
];

const TAB_OPTIONS: Array<{ key: PurchasingTabKey; label: string }> = [
  { key: "dashboard", label: "1. Ringkasan" },
  { key: "orders", label: "2. Pesanan PO & PR" },
  { key: "vendors", label: "3. Vendor & Harga" },
  { key: "history", label: "4. Riwayat Aktivitas" },
];

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca file gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak valid."));
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas tidak tersedia."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.78);
        if (compressed.length > 340000) {
          resolve(canvas.toDataURL("image/jpeg", 0.55));
        } else {
          resolve(compressed);
        }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

export default function DashboardCustomizerModal({
  userName,
  userIdCard,
  currentPrefs,
  onClose,
  onSave,
  onResetDefault,
}: DashboardCustomizerModalProps) {
  const [draft, setDraft] = useState<PurchasingDashboardPrefs>(() => ({
    ...currentPrefs,
    visibleStatKeys: { ...currentPrefs.visibleStatKeys },
    statOrder: [...currentPrefs.statOrder],
  }));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [bgError, setBgError] = useState<string>("");

  const isCustom = isPurchasingPrefsCustomized(draft);

  const moveStat = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= draft.statOrder.length) return;
    setDraft((prev) => {
      const next = [...prev.statOrder];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return { ...prev, statOrder: next };
    });
  };

  const toggleStatVisible = (key: PurchasingStatKey) => {
    setDraft((prev) => ({
      ...prev,
      visibleStatKeys: {
        ...prev.visibleStatKeys,
        [key]: !prev.visibleStatKeys[key],
      },
    }));
  };

  const handleUploadBgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgError("");
    if (file.size > 5 * 1024 * 1024) {
      setBgError("Ukuran file terlalu besar (maks 5 MB sebelum kompresi).");
      e.target.value = "";
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setDraft((p) => ({
        ...p,
        bgPreset: "custom",
        bgImageData: dataUrl,
      }));
    } catch (err: unknown) {
      setBgError(err instanceof Error ? err.message : "Gagal memproses gambar background.");
    }
    e.target.value = "";
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    const ok = await onSave(draft);
    setIsSaving(false);
    if (ok) onClose();
  };

  const handleResetClick = async () => {
    setIsSaving(true);
    const ok = await onResetDefault();
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Personalisasi Dashboard
            </span>
            {isCustom && (
              <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                Mode Custom
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            Atur Background, Tampilan &amp; Restore Default
          </h3>
          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-start gap-2 text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Khusus akun <b>{userName}</b> (<code className="font-mono font-bold">{userIdCard}</code>). Perubahan &amp; Restore Default hanya berlaku untuk akun Anda dan <b>tidak memengaruhi staf lain</b> maupun data PO.
            </span>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* 0. Background Halaman Utama Dashboard */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-bold text-slate-800 flex items-center gap-1.5">
                <ImagePlus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Background Halaman Dashboard</span>
              </p>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 font-semibold cursor-pointer">
                <span>Warna Bebas:</span>
                <input
                  type="color"
                  value={draft.bgCustomColor || "#0f172a"}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      bgPreset: "custom",
                      bgCustomColor: e.target.value,
                      bgImageData: "",
                    }))
                  }
                  className="w-6 h-6 rounded border border-slate-300 cursor-pointer bg-white p-0"
                  title="Pilih warna background kustom"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {BACKGROUND_PRESET_OPTIONS.map((opt) => {
                const active = draft.bgPreset === opt.key && !draft.bgImageData;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        bgPreset: opt.key as DashboardBgPreset,
                        bgImageData: "",
                      }))
                    }
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border shrink-0 ${opt.swatchClass}`} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Image Wallpaper Upload */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer transition">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>{draft.bgImageData ? "Ganti Gambar Background" : "Upload Gambar (JPG/PNG/WebP)"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handleUploadBgImage(e)}
                    className="hidden"
                  />
                </label>
                {draft.bgImageData && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        bgImageData: "",
                        bgPreset: p.bgCustomColor ? "custom" : "default",
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Hapus Gambar</span>
                  </button>
                )}
              </div>

              {draft.bgImageData && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-slate-600 whitespace-nowrap">
                    Overlay: {draft.bgOverlayOpacity}%
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={85}
                    value={draft.bgOverlayOpacity}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, bgOverlayOpacity: Number(e.target.value) }))
                    }
                    className="w-24 accent-emerald-600 cursor-pointer"
                  />
                </div>
              )}
            </div>
            {bgError && <p className="text-[11px] text-rose-600 font-semibold">{bgError}</p>}
          </div>

          {/* 1. Tema & Tab Awal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-emerald-600" />
                <span>Warna Banner</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDraft((p) => ({ ...p, themeColor: opt.key }))}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] font-semibold cursor-pointer transition ${
                      draft.themeColor === opt.key
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full shrink-0 ${opt.dotClass}`} />
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1.5">
                Tab Awal Saat Login
              </label>
              <select
                value={draft.defaultTab}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, defaultTab: e.target.value as PurchasingTabKey }))
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
              >
                {TAB_OPTIONS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>

              <label className="block font-bold text-slate-800 mt-3 mb-1">
                Kepadatan Tabel
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, compactTable: false }))}
                  className={`flex-1 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                    !draft.compactTable
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Normal (Lega)
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, compactTable: true }))}
                  className={`flex-1 py-1.5 rounded-lg border font-semibold cursor-pointer ${
                    draft.compactTable
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Ringkas
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Catatan / Sapaan Pribadi di Banner <span className="font-normal text-slate-400">(Opsional)</span>
            </label>
            <input
              type="text"
              value={draft.customTitle}
              onChange={(e) => setDraft((p) => ({ ...p, customTitle: e.target.value }))}
              placeholder="Kosongkan untuk judul standar modul Purchasing"
              maxLength={80}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:border-emerald-500 outline-none"
            />
          </div>

          {/* 2. Visibilitas Seksi */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="font-bold text-slate-800">Tampilkan / Sembunyikan Bagian Dashboard</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "showBanner" as const, label: "Banner Utama" },
                { key: "showStats" as const, label: "Kartu Ringkasan Statistik" },
                { key: "showDeliveryAlerts" as const, label: "Alert Kedatangan Gudang" },
                { key: "showQuickActions" as const, label: "Aksi Cepat Pengadaan" },
                { key: "showChatbot" as const, label: "Chatbot AI Pojok Kanan" },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={draft[item.key]}
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, [item.key]: e.target.checked }))
                    }
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                  />
                  <span className="text-[11px] font-semibold text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Urutan & Visibilitas Kartu Statistik */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <p className="font-bold text-slate-800">
              Urutan &amp; Pilihan Kartu Statistik
            </p>
            <div className="space-y-1.5">
              {draft.statOrder.map((statKey, idx) => {
                const visible = draft.visibleStatKeys[statKey];
                return (
                  <div
                    key={statKey}
                    className={`flex items-center justify-between gap-2 bg-white border rounded-lg px-3 py-1.5 ${
                      visible ? "border-slate-200" : "border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-400 w-4">
                        #{idx + 1}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-800">
                        {PURCHASING_STAT_LABELS[statKey]}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveStat(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                        title="Geser Naik"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveStat(idx, 1)}
                        disabled={idx === draft.statOrder.length - 1}
                        className="p-1 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-30 cursor-pointer"
                        title="Geser Turun"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleStatVisible(statKey)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          visible
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{visible ? "Tampil" : "Sembunyi"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions: Restore Default & Save */}
        <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore / Reset Default</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleResetClick()}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ya, Kembalikan Default</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void handleSaveClick()}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSaving ? "Menyimpan..." : "Simpan Tampilan Saya"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
