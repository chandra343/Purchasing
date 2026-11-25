import type { CSSProperties } from "react";

export type PurchasingThemeColor = "emerald" | "indigo" | "slate" | "violet";
export type DashboardBgPreset =
  | "default"
  | "dark"
  | "ocean"
  | "emerald"
  | "violet"
  | "sunset"
  | "custom";
export type PurchasingTabKey = "dashboard" | "orders" | "vendors" | "history";
export type PurchasingStatKey =
  | "totalSpending"
  | "totalUnpaid"
  | "totalPaid"
  | "receivedCount"
  | "lowStockGudang";

export interface PurchasingDashboardPrefs {
  customTitle: string;
  themeColor: PurchasingThemeColor;
  bgPreset: DashboardBgPreset;
  bgCustomColor: string;
  bgImageData: string;
  bgOverlayOpacity: number;
  defaultTab: PurchasingTabKey;
  showBanner: boolean;
  showStats: boolean;
  showDeliveryAlerts: boolean;
  showQuickActions: boolean;
  showChatbot: boolean;
  compactTable: boolean;
  visibleStatKeys: Record<PurchasingStatKey, boolean>;
  statOrder: PurchasingStatKey[];
}

export const ALL_PURCHASING_STAT_KEYS: PurchasingStatKey[] = [
  "totalSpending",
  "totalUnpaid",
  "totalPaid",
  "receivedCount",
  "lowStockGudang",
];

export const PURCHASING_STAT_LABELS: Record<PurchasingStatKey, string> = {
  totalSpending: "Total Belanja Pengadaan",
  totalUnpaid: "Tagihan Belum Lunas (Tempo)",
  totalPaid: "Pembayaran Lunas (Kasir)",
  receivedCount: "Kedatangan di Gudang",
  lowStockGudang: "Barang Gudang Menipis",
};

export interface BackgroundPresetOption {
  key: DashboardBgPreset;
  label: string;
  swatchClass: string;
  containerClass: string;
}

export const BACKGROUND_PRESET_OPTIONS: BackgroundPresetOption[] = [
  {
    key: "default",
    label: "Default Terang",
    swatchClass: "bg-slate-100 border-slate-300",
    containerClass: "bg-slate-50 text-slate-800",
  },
  {
    key: "dark",
    label: "Gelap (Night)",
    swatchClass: "bg-slate-900 border-slate-700",
    containerClass: "bg-slate-950 text-slate-800",
  },
  {
    key: "ocean",
    label: "Samudra Biru",
    swatchClass: "bg-gradient-to-br from-sky-700 to-indigo-900 border-sky-500",
    containerClass: "bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 text-slate-800",
  },
  {
    key: "emerald",
    label: "Hijau Zamrud",
    swatchClass: "bg-gradient-to-br from-emerald-700 to-teal-900 border-emerald-500",
    containerClass: "bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-slate-800",
  },
  {
    key: "violet",
    label: "Ungu Modern",
    swatchClass: "bg-gradient-to-br from-violet-700 to-indigo-900 border-violet-500",
    containerClass: "bg-gradient-to-br from-slate-900 via-violet-950 to-indigo-950 text-slate-800",
  },
  {
    key: "sunset",
    label: "Senja Hangat",
    swatchClass: "bg-gradient-to-br from-amber-200 to-rose-200 border-amber-300",
    containerClass: "bg-gradient-to-br from-amber-50 via-rose-50 to-orange-100 text-slate-800",
  },
];

export const DEFAULT_PURCHASING_PREFS: PurchasingDashboardPrefs = {
  customTitle: "",
  themeColor: "emerald",
  bgPreset: "default",
  bgCustomColor: "",
  bgImageData: "",
  bgOverlayOpacity: 35,
  defaultTab: "dashboard",
  showBanner: true,
  showStats: true,
  showDeliveryAlerts: true,
  showQuickActions: true,
  showChatbot: true,
  compactTable: false,
  visibleStatKeys: {
    totalSpending: true,
    totalUnpaid: true,
    totalPaid: true,
    receivedCount: true,
    lowStockGudang: true,
  },
  statOrder: [...ALL_PURCHASING_STAT_KEYS],
};

const VALID_THEMES = new Set<PurchasingThemeColor>(["emerald", "indigo", "slate", "violet"]);
const VALID_BG_PRESETS = new Set<DashboardBgPreset>([
  "default",
  "dark",
  "ocean",
  "emerald",
  "violet",
  "sunset",
  "custom",
]);
const VALID_TABS = new Set<PurchasingTabKey>(["dashboard", "orders", "vendors", "history"]);

export function sanitizeHexColor(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const cleaned = raw.trim();
  return /^#[0-9a-fA-F]{6}$/.test(cleaned) ? cleaned.toLowerCase() : "";
}

export function sanitizeBgImageUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 350000) return "";
  if (/["'()<>\\;\n\r]/.test(trimmed)) return "";
  if (/^data:image\/(?:jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\/[^\s"'<>()]+$/i.test(trimmed)) {
    return trimmed;
  }
  return "";
}

export function parsePurchasingPrefs(raw?: string | null): PurchasingDashboardPrefs {
  if (!raw) {
    return {
      ...DEFAULT_PURCHASING_PREFS,
      visibleStatKeys: { ...DEFAULT_PURCHASING_PREFS.visibleStatKeys },
      statOrder: [...DEFAULT_PURCHASING_PREFS.statOrder],
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PurchasingDashboardPrefs>;
    const rawOrder = Array.isArray(parsed.statOrder) ? parsed.statOrder : [];
    const seen = new Set<PurchasingStatKey>();
    const normalizedOrder: PurchasingStatKey[] = [];
    for (const k of rawOrder) {
      if (ALL_PURCHASING_STAT_KEYS.includes(k) && !seen.has(k)) {
        seen.add(k);
        normalizedOrder.push(k);
      }
    }
    for (const k of ALL_PURCHASING_STAT_KEYS) {
      if (!seen.has(k)) normalizedOrder.push(k);
    }

    const bgOverlayNum =
      typeof parsed.bgOverlayOpacity === "number" && Number.isFinite(parsed.bgOverlayOpacity)
        ? Math.min(85, Math.max(0, Math.round(parsed.bgOverlayOpacity)))
        : DEFAULT_PURCHASING_PREFS.bgOverlayOpacity;

    return {
      customTitle: typeof parsed.customTitle === "string" ? parsed.customTitle.slice(0, 80) : "",
      themeColor:
        parsed.themeColor && VALID_THEMES.has(parsed.themeColor)
          ? parsed.themeColor
          : DEFAULT_PURCHASING_PREFS.themeColor,
      bgPreset:
        parsed.bgPreset && VALID_BG_PRESETS.has(parsed.bgPreset)
          ? parsed.bgPreset
          : DEFAULT_PURCHASING_PREFS.bgPreset,
      bgCustomColor: sanitizeHexColor(parsed.bgCustomColor),
      bgImageData: sanitizeBgImageUrl(parsed.bgImageData),
      bgOverlayOpacity: bgOverlayNum,
      defaultTab:
        parsed.defaultTab && VALID_TABS.has(parsed.defaultTab)
          ? parsed.defaultTab
          : DEFAULT_PURCHASING_PREFS.defaultTab,
      showBanner: typeof parsed.showBanner === "boolean" ? parsed.showBanner : true,
      showStats: typeof parsed.showStats === "boolean" ? parsed.showStats : true,
      showDeliveryAlerts:
        typeof parsed.showDeliveryAlerts === "boolean" ? parsed.showDeliveryAlerts : true,
      showQuickActions:
        typeof parsed.showQuickActions === "boolean" ? parsed.showQuickActions : true,
      showChatbot: typeof parsed.showChatbot === "boolean" ? parsed.showChatbot : true,
      compactTable: typeof parsed.compactTable === "boolean" ? parsed.compactTable : false,
      visibleStatKeys: {
        totalSpending: parsed.visibleStatKeys?.totalSpending ?? true,
        totalUnpaid: parsed.visibleStatKeys?.totalUnpaid ?? true,
        totalPaid: parsed.visibleStatKeys?.totalPaid ?? true,
        receivedCount: parsed.visibleStatKeys?.receivedCount ?? true,
        lowStockGudang: parsed.visibleStatKeys?.lowStockGudang ?? true,
      },
      statOrder: normalizedOrder,
    };
  } catch {
    return {
      ...DEFAULT_PURCHASING_PREFS,
      visibleStatKeys: { ...DEFAULT_PURCHASING_PREFS.visibleStatKeys },
      statOrder: [...DEFAULT_PURCHASING_PREFS.statOrder],
    };
  }
}

export function isPurchasingPrefsCustomized(prefs: PurchasingDashboardPrefs): boolean {
  return JSON.stringify(prefs) !== JSON.stringify(DEFAULT_PURCHASING_PREFS);
}

export function getPurchasingBannerClass(theme: PurchasingThemeColor): string {
  switch (theme) {
    case "indigo":
      return "from-slate-900 via-indigo-950 to-slate-900";
    case "slate":
      return "from-slate-900 via-slate-800 to-slate-900";
    case "violet":
      return "from-slate-900 via-violet-950 to-slate-900";
    case "emerald":
    default:
      return "from-slate-900 via-emerald-950 to-slate-900";
  }
}

export function getDashboardBackgroundStyle(prefs: {
  bgPreset: DashboardBgPreset;
  bgCustomColor: string;
  bgImageData: string;
  bgOverlayOpacity: number;
}): {
  containerClass: string;
  containerStyle?: CSSProperties;
  safeImageUrl: string;
  overlayOpacity: number;
  isCustomBg: boolean;
} {
  const safeImageUrl = sanitizeBgImageUrl(prefs.bgImageData);
  const safeColor = sanitizeHexColor(prefs.bgCustomColor);
  const overlayOpacity = Math.min(85, Math.max(0, prefs.bgOverlayOpacity)) / 100;

  if (safeImageUrl) {
    return {
      containerClass: "bg-slate-900 text-slate-800",
      safeImageUrl,
      overlayOpacity,
      isCustomBg: true,
    };
  }

  if (prefs.bgPreset === "custom" && safeColor) {
    return {
      containerClass: "text-slate-800",
      containerStyle: { backgroundColor: safeColor },
      safeImageUrl: "",
      overlayOpacity: 0,
      isCustomBg: true,
    };
  }

  const matched =
    BACKGROUND_PRESET_OPTIONS.find((p) => p.key === prefs.bgPreset) ||
    BACKGROUND_PRESET_OPTIONS[0];

  return {
    containerClass: matched.containerClass,
    safeImageUrl: "",
    overlayOpacity: 0,
    isCustomBg: matched.key !== "default",
  };
}
