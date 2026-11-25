export type PurchasingThemeColor = "emerald" | "indigo" | "slate" | "violet";
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

export const DEFAULT_PURCHASING_PREFS: PurchasingDashboardPrefs = {
  customTitle: "",
  themeColor: "emerald",
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
const VALID_TABS = new Set<PurchasingTabKey>(["dashboard", "orders", "vendors", "history"]);

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

    return {
      customTitle: typeof parsed.customTitle === "string" ? parsed.customTitle.slice(0, 80) : "",
      themeColor:
        parsed.themeColor && VALID_THEMES.has(parsed.themeColor)
          ? parsed.themeColor
          : DEFAULT_PURCHASING_PREFS.themeColor,
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
