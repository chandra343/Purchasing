"use client";

import React, { useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";

export default function PurchasingErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isRecovering, setIsRecovering] = useState(false);

  const handleEmergencyRestore = async () => {
    setIsRecovering(true);
    try {
      const savedRaw = localStorage.getItem("purchasing_logged_in_staff");
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as { idCard?: string; dashboardConfigJson?: string | null };
        if (parsed?.idCard) {
          await fetch("/api/dashboard/reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idCard: parsed.idCard }),
          });
          localStorage.setItem(
            "purchasing_logged_in_staff",
            JSON.stringify({ ...parsed, dashboardConfigJson: null })
          );
        }
      }
    } catch {
      // Abaikan jika localStorage kosong
    } finally {
      setIsRecovering(false);
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-rose-200 shadow-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              Terjadi Gangguan Halaman Purchasing
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Data PO & vendor tetap aman. Gunakan tombol di bawah untuk memuat ulang atau memulihkan tampilan akun Anda ke Default.
            </p>
          </div>
        </div>

        <div className="bg-slate-900 text-rose-200 rounded-xl p-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-bold mb-1 uppercase">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Pesan Error</span>
          </div>
          <p className="break-words">{error?.message || "Unexpected client error"}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleEmergencyRestore()}
            disabled={isRecovering}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isRecovering ? "Memulihkan..." : "Restore Default Akun Saya"}</span>
          </button>

          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang</span>
          </button>
        </div>
      </div>
    </div>
  );
}
