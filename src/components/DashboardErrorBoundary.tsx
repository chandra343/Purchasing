"use client";

import React from "react";
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";

interface DashboardErrorBoundaryProps {
  children: React.ReactNode;
  userIdCard?: string;
  userName?: string;
  resetKey?: string;
  onRestoreDefault?: () => Promise<boolean>;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  isRestoring: boolean;
}

export default class DashboardErrorBoundary extends React.Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      isRestoring: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<DashboardErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || "Terjadi kesalahan rendering komponen dashboard.",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[DashboardErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: DashboardErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: "", isRestoring: false });
    }
  }

  handleSafeModeRestore = async () => {
    this.setState({ isRestoring: true });
    try {
      if (this.props.onRestoreDefault) {
        await this.props.onRestoreDefault();
      } else if (this.props.userIdCard) {
        await fetch("/api/dashboard/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idCard: this.props.userIdCard }),
        });
      }
      this.setState({ hasError: false, errorMessage: "", isRestoring: false });
    } catch {
      this.setState({ isRestoring: false });
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="max-w-2xl mx-auto my-10 px-4">
        <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Terjadi Error pada Tampilan Dashboard Pribadi Anda
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Jangan khawatir — <b>data PO/vendor dan tampilan staf lain tetap aman</b>. Error ini hanya terjadi pada sesi/tampilan akun{" "}
                <b>{this.props.userName || this.props.userIdCard || "Anda"}</b>.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-rose-200 rounded-xl p-3 text-xs font-mono overflow-x-auto">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-rose-400 font-bold mb-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Detail Error Teknis</span>
            </div>
            <p className="break-words">{this.state.errorMessage}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => void this.handleSafeModeRestore()}
              disabled={this.state.isRestoring}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {this.state.isRestoring
                  ? "Memulihkan Default..."
                  : "Pulihkan Tampilan Default (Safe Mode)"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: "" })}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Render Ulang</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
