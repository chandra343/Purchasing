"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  loginStaffWithIdCard,
  createPurchaseOrder,
  createVendor,
  createStaffIdCard,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  syncTaxFromPajakIndonesia,
  recordPoPayment,
  createOrUpdateVendorPrice,
  deleteVendorPrice,
  syncVendorPriceChange,
  updateStaffTelegram,
  updateTelegramBotConfig,
  testStaffTelegramNotification,
  saveNineRouterConfig,
  testNineRouterConnection,
  saveStaffDashboardPrefs,
  resetStaffDashboardPrefs,
  logoutStaffSession,
} from "@/app/actions";
import {
  DEFAULT_PURCHASING_PREFS,
  PurchasingDashboardPrefs,
  PurchasingStatKey,
  PurchasingThemeColor,
  getDashboardBackgroundStyle,
  getPurchasingBannerClass,
  isPurchasingPrefsCustomized,
  parsePurchasingPrefs,
} from "@/lib/dashboardPrefs";
import {
  ShoppingCart,
  Package,
  Warehouse,
  CreditCard,
  UserCheck,
  LogOut,
  ChevronDown,
  Building2,
  Phone,
  MessageCircle,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Send,
  Boxes,
  RefreshCw,
  FileText,
  Printer,
  Search,
  ExternalLink,
  Calendar,
  X,
  BadgeCheck,
  TrendingUp,
  Truck,
  Eye,
  Camera,
  Clock,
  Bell,
  Store,
  Sparkles,
  Landmark,
  ShieldCheck,
  Scale,
  History,
  Filter,
  ArrowUpDown,
  RotateCcw,
  Trash2,
  Banknote,
  Receipt,
  Wallet,
  Check,
  Tag,
  Award,
  Zap,
  Layers,
  Cpu,
  LayoutDashboard,
} from "lucide-react";
import LocationMapEmbed from "./LocationMapEmbed";
import NineRouterModal from "./NineRouterModal";
import NineRouterChatbot, { ChatbotDashboardAction } from "./NineRouterChatbot";
import DashboardCustomizerModal from "./DashboardCustomizerModal";
import DashboardErrorBoundary from "./DashboardErrorBoundary";

export interface CurrentStaff {
  id: string;
  idCard: string;
  name: string;
  position: string;
  role: string;
  telegramChatId?: string | null;
  telegramUsername?: string | null;
  telegramEnabled?: boolean;
  dashboardConfigJson?: string | null;
}

export default function PurchasingClient({ initialData }: { initialData: any }) {
  const router = useRouter();

  // Authentication State
  const [currentStaff, setCurrentStaff] = useState<CurrentStaff | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [loginIdInput, setLoginIdInput] = useState<string>("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [showStaffDropdown, setShowStaffDropdown] = useState<boolean>(false);
  const staffDropdownRef = useRef<HTMLDivElement>(null);

  // Notification Toast
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showMessage(type: "success" | "error", text: string) {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  }

  // Active Navigation Tab (4 Menu Utama: Ringkasan, Pesanan PO, Vendor & Harga, Riwayat)
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "orders" | "vendors" | "history" | "requisitions" | "priceComparison" | "priceManager" | "gudangCatalog"
  >("dashboard");

  // Sub-tab untuk Tab Pesanan (PO & PR)
  const [orderSubTab, setOrderSubTab] = useState<"ALL" | "WAITING" | "RECEIVED" | "UNPAID" | "PR">("ALL");

  // Sub-tab untuk Tab Vendor & Harga (Katalog Komparasi, Update Harga, Direktori, Stok Gudang)
  const [vendorSubTab, setVendorSubTab] = useState<"catalog" | "priceManager" | "directory" | "gudangStock">("catalog");

  // State Komparasi Harga Bahan Baku & Penawaran Vendor
  const [priceSearchQuery, setPriceSearchQuery] = useState<string>("");
  const [priceCategoryFilter, setPriceCategoryFilter] = useState<string>("ALL");
  const [priceSortBy, setPriceSortBy] = useState<"PRICE_ASC" | "PRICE_DESC" | "LEAD_TIME">("PRICE_ASC");
  const [showAddPriceModal, setShowAddPriceModal] = useState<boolean>(false);
  const [isSubmittingPrice, setIsSubmittingPrice] = useState<boolean>(false);
  const [newPriceForm, setNewPriceForm] = useState({
    productName: "",
    category: "Bahan Baku Plastik",
    vendorName: "",
    vendorPhone: "",
    vendorWhatsapp: "",
    vendorAddress: "",
    unit: "kg",
    unitPrice: 0,
    minOrderQty: 1,
    leadTimeDays: 2,
    paymentTerms: "TEMPO_30",
    grade: "",
    notes: "",
  });

  // Fitur Khusus: Kelola & Pembaruan Harga Vendor (Price Manager)
  const [managerSelectedVendor, setManagerSelectedVendor] = useState<string>("");
  const [managerSelectedPriceId, setManagerSelectedPriceId] = useState<string>("");
  const [managerNewPrice, setManagerNewPrice] = useState<number>(0);
  const [managerReason, setManagerReason] = useState<string>("Pricelist Resmi Kuartal Baru Vendor");
  const [managerNotes, setManagerNotes] = useState<string>("");
  const [isSavingManagerPrice, setIsSavingManagerPrice] = useState<boolean>(false);
  const [managerSearchQuery, setManagerSearchQuery] = useState<string>("");
  const [managerCategoryFilter, setManagerCategoryFilter] = useState<string>("ALL");

  // Fitur Khusus: Riwayat Aktivitas & Audit Log Pengadaan (Activity Log)
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("ALL");
  const [historySearchQuery, setHistorySearchQuery] = useState<string>("");

  // Modal Ubah & Sinkronisasi Harga Vendor
  const [editSyncPriceItem, setEditSyncPriceItem] = useState<any | null>(null);
  const [editPriceForm, setEditPriceForm] = useState({
    newPrice: 0,
    reason: "",
  });
  const [isSubmittingSyncPrice, setIsSubmittingSyncPrice] = useState<boolean>(false);
  const [showPriceHistoryItem, setShowPriceHistoryItem] = useState<any | null>(null);
  const [syncPriceInCreatePo, setSyncPriceInCreatePo] = useState<boolean>(true);

  // Modals
  const [showCreatePoModal, setShowCreatePoModal] = useState<boolean>(false);
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false);
  const [previewPoModal, setPreviewPoModal] = useState<any | null>(null);
  const [selectedDeliveryProof, setSelectedDeliveryProof] = useState<any | null>(null);
  // Filter & Search State untuk Purchase Orders (PO)
  const [poSearchQuery, setPoSearchQuery] = useState<string>("");
  const [poStatusFilter, setPoStatusFilter] = useState<"ALL" | "WAITING" | "RECEIVED">("ALL");
  const [poPaymentFilter, setPoPaymentFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [poVendorFilter, setPoVendorFilter] = useState<string>("ALL");
  const [poSortBy, setPoSortBy] = useState<"NEWEST" | "OLDEST" | "AMOUNT_DESC" | "AMOUNT_ASC">("NEWEST");
  const [showTaxModal, setShowTaxModal] = useState<boolean>(false);
  const [isSyncingTax, setIsSyncingTax] = useState<boolean>(false);
  const [isSubmittingPo, setIsSubmittingPo] = useState<boolean>(false);

  // Modal Kasir & Pembayaran PO
  const [paymentModalPo, setPaymentModalPo] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentStatus: "PAID" as "UNPAID" | "PARTIAL" | "PAID",
    paidAmount: 0,
    paymentMethod: "TRANSFER_BANK",
    paymentTerms: "TEMPO_30",
    paymentNotes: "",
    paymentProofUrl: "",
  });
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Integrasi Notifikasi Telegram ID Card & Bot Perusahaan
  const [showTelegramModal, setShowTelegramModal] = useState<boolean>(false);
  const [telegramTab, setTelegramTab] = useState<"staff" | "bot">("staff");
  const [telegramChatIdInput, setTelegramChatIdInput] = useState<string>("");
  const [telegramUsernameInput, setTelegramUsernameInput] = useState<string>("");
  const [telegramEnabledInput, setTelegramEnabledInput] = useState<boolean>(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState<boolean>(false);
  const [telegramTestFeedback, setTelegramTestFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Konfigurasi Bot Telegram Perusahaan
  const [botTokenInput, setBotTokenInput] = useState<string>(initialData?.telegramConfig?.botToken || "");
  const [botUsernameInput, setBotUsernameInput] = useState<string>(initialData?.telegramConfig?.botUsername || "");
  const [botActiveInput, setBotActiveInput] = useState<boolean>(initialData?.telegramConfig?.isActive ?? true);
  const [isSavingBotConfig, setIsSavingBotConfig] = useState<boolean>(false);

  // Integrasi 9Router AI Gateway & Personalisasi Dashboard Per Staf
  const [showNineRouterModal, setShowNineRouterModal] = useState<boolean>(false);
  const [showCustomizerModal, setShowCustomizerModal] = useState<boolean>(false);
  const [nineRouterStatus, setNineRouterStatus] = useState<{
    connected: boolean;
    modelsCount?: number;
  }>({
    connected: initialData?.nineRouterConfig?.lastStatus === "CONNECTED",
  });

  const dashboardPrefs = useMemo(
    () => parsePurchasingPrefs(currentStaff?.dashboardConfigJson),
    [currentStaff?.dashboardConfigJson]
  );
  const isDashboardCustomized = useMemo(
    () => isPurchasingPrefsCustomized(dashboardPrefs),
    [dashboardPrefs]
  );
  const bgStyle = useMemo(
    () => getDashboardBackgroundStyle(dashboardPrefs),
    [dashboardPrefs]
  );

  useEffect(() => {
    fetch("/api/ai/status")
      .then((r) => r.json())
      .then((d) => {
        if (d?.nineRouter) {
          setNineRouterStatus({
            connected: Boolean(d.nineRouter.connected),
            modelsCount: d.nineRouter.modelsCount || 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Ringkasan konteks live Purchasing untuk Chatbot AI 9Router
  const chatbotContextSummary = useMemo(() => {
    const posSummary = (initialData?.purchaseOrders || [])
      .slice(0, 15)
      .map(
        (po: any) =>
          `- ${po.poNumber} | Vendor: ${po.supplierName} | Total: Rp ${Number(po.totalAmount || 0).toLocaleString("id-ID")} | Status Gudang: ${po.status} | Bayar: ${po.paymentStatus}`
      )
      .join("\n");
    const priceSummary = (initialData?.vendorPrices || [])
      .slice(0, 20)
      .map(
        (vp: any) =>
          `- ${vp.productName}: Rp ${Number(vp.unitPrice || 0).toLocaleString("id-ID")}/${vp.unit} dari ${vp.vendorName}${vp.isBestPrice ? " [TERMURAH]" : ""}`
      )
      .join("\n");

    return [
      `Statistik Purchasing: ${initialData?.stats?.totalPOs || 0} PO, Total Belanja Rp ${Number(initialData?.stats?.totalSpending || 0).toLocaleString("id-ID")}, Belum Lunas: ${initialData?.stats?.unpaidCount || 0}, Stok Kritis Gudang: ${initialData?.stats?.lowStockGudangCount || 0}, PR Pending: ${initialData?.stats?.pendingPRsGudangCount || 0}`,
      posSummary ? `Daftar Purchase Order Terbaru:\n${posSummary}` : "",
      priceSummary ? `Katalog Harga Vendor:\n${priceSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }, [initialData]);

  // Form State Buat PO Baru (Mendukung Multi-Item Keranjang)
  interface NewPoFormState {
    supplierName: string;
    supplierPhone: string;
    supplierWhatsapp: string;
    supplierAddress: string;
    orderDate?: string;
    expectedDeliveryDate: string;
    notes: string;
    paymentTerms: string;
    paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
    paidAmount: number;
    taxRate: number;
    taxCategory: string;
    taxLegalBasis: string;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      unit: string;
      unitPrice: number;
    }>;
  }

  const [newPoForm, setNewPoForm] = useState<NewPoFormState>({
    supplierName: "",
    supplierPhone: "",
    supplierWhatsapp: "",
    supplierAddress: "",
    orderDate: new Date().toISOString().slice(0, 10),
    expectedDeliveryDate: "",
    notes: "",
    paymentTerms: "TEMPO_30", // CASH, COD, TEMPO_14, TEMPO_30, TEMPO_60, DP_50
    paymentStatus: "UNPAID",
    paidAmount: 0,
    taxRate: initialData.taxSetting?.rate || 12,
    taxCategory: "STANDAR_12",
    taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
    items: [
      {
        id: "item-1",
        productId: "",
        productName: "",
        quantity: 1,
        unit: "unit",
        unitPrice: 100000,
      },
    ],
  });

  // Auto-Detect State untuk Perusahaan / Retail
  const [supplierMatch, setSupplierMatch] = useState<any | null>(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState<any[]>([]);

  // Item Cart Handlers for Multi-Item PO
  const addItemRow = () => {
    setNewPoForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}-${Math.random()}`,
          productId: "",
          productName: "",
          quantity: 1,
          unit: "unit",
          unitPrice: 0,
        },
      ],
    }));
  };

  const removeItemRow = (idx: number) => {
    if (newPoForm.items.length <= 1) return;
    setNewPoForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const updateItemRow = (idx: number, field: string, value: any) => {
    setNewPoForm((prev) => {
      const copy = [...prev.items];
      copy[idx] = { ...copy[idx], [field]: value };
      return { ...prev, items: copy };
    });
  };

  const handleSelectProductForItem = (idx: number, prod: any) => {
    setNewPoForm((prev) => {
      const copy = [...prev.items];
      copy[idx] = {
        ...copy[idx],
        productId: prod.id || "",
        productName: prod.name || "",
        unit: prod.unit || copy[idx].unit || "unit",
      };
      return { ...prev, items: copy };
    });
  };

  const cartSubtotal = useMemo(() => {
    return newPoForm.items.reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
      0
    );
  }, [newPoForm.items]);

  const cartTax = useMemo(() => {
    return Math.round(cartSubtotal * ((Number(newPoForm.taxRate) || 0) / 100));
  }, [cartSubtotal, newPoForm.taxRate]);

  const cartTotal = useMemo(() => {
    return cartSubtotal + cartTax;
  }, [cartSubtotal, cartTax]);

  // Gabungkan semua vendor & supplier yang diketahui
  const allKnownSuppliers = useMemo(() => {
    const list: any[] = [...(initialData.vendors || [])];
    const seenNames = new Set(list.map((v: any) => v.name.trim().toLowerCase()));

    for (const p of initialData?.gudangIntegration?.products || []) {
      if (p.supplier?.name) {
        const lower = p.supplier.name.trim().toLowerCase();
        if (!seenNames.has(lower)) {
          seenNames.add(lower);
          list.push({
            id: p.supplier.id || `sup-${lower}`,
            name: p.supplier.name,
            phone: p.supplier.phone,
            whatsapp: p.supplier.whatsapp,
            address: p.supplier.address,
            category: p.category || "Pemasok Gudang",
          });
        }
      }
    }
    return list;
  }, [initialData]);

  // Opsi Vendor dari Data Purchase Orders
  const poVendorOptions = useMemo(() => {
    const set = new Set<string>();
    (initialData.purchaseOrders || []).forEach((po: any) => {
      if (po.supplierName) set.add(po.supplierName);
    });
    return Array.from(set);
  }, [initialData.purchaseOrders]);

  const waitingPoCount = useMemo(() => {
    return (initialData.purchaseOrders || []).filter((po: any) => po.status !== "RECEIVED").length;
  }, [initialData.purchaseOrders]);

  const receivedPoCount = useMemo(() => {
    return (initialData.purchaseOrders || []).filter((po: any) => po.status === "RECEIVED").length;
  }, [initialData.purchaseOrders]);

  const isAnyPoFilterActive = Boolean(
    poSearchQuery.trim() !== "" ||
      poStatusFilter !== "ALL" ||
      poPaymentFilter !== "ALL" ||
      poVendorFilter !== "ALL" ||
      poSortBy !== "NEWEST"
  );

  const handleResetPoFilters = () => {
    setPoSearchQuery("");
    setPoStatusFilter("ALL");
    setPoPaymentFilter("ALL");
    setPoVendorFilter("ALL");
    setPoSortBy("NEWEST");
  };

  // Filtered & Sorted Purchase Orders
  const filteredPurchaseOrders = useMemo(() => {
    let list = [...(initialData.purchaseOrders || [])];

    // Filter berdasarkan Sub-Tab Pesanan Cepat
    if (orderSubTab === "WAITING") {
      list = list.filter((po: any) => po.status !== "RECEIVED");
    } else if (orderSubTab === "RECEIVED") {
      list = list.filter((po: any) => po.status === "RECEIVED");
    } else if (orderSubTab === "UNPAID") {
      list = list.filter((po: any) => po.paymentStatus !== "PAID");
    } else if (orderSubTab === "ALL") {
      // Filter Status Kedatangan Gudang
      if (poStatusFilter === "WAITING") {
        list = list.filter((po: any) => po.status !== "RECEIVED");
      } else if (poStatusFilter === "RECEIVED") {
        list = list.filter((po: any) => po.status === "RECEIVED");
      }

      // Filter Status Pembayaran Kasir
      if (poPaymentFilter === "UNPAID") {
        list = list.filter((po: any) => po.paymentStatus !== "PAID");
      } else if (poPaymentFilter === "PAID") {
        list = list.filter((po: any) => po.paymentStatus === "PAID");
      }
    }

    // Filter Vendor / Perusahaan
    if (poVendorFilter !== "ALL") {
      list = list.filter((po: any) => po.supplierName === poVendorFilter);
    }

    // Search Query: No PO, Vendor, Nama Barang, Pembuat, Catatan
    if (poSearchQuery.trim()) {
      const q = poSearchQuery.toLowerCase().trim();
      list = list.filter((po: any) => {
        const matchPoNumber = po.poNumber?.toLowerCase().includes(q);
        const matchSupplier = po.supplierName?.toLowerCase().includes(q);
        const matchCreatedBy = po.createdBy?.toLowerCase().includes(q);
        const matchNotes = po.notes?.toLowerCase().includes(q);
        const matchItems = po.items?.some((it: any) =>
          it.productName?.toLowerCase().includes(q) || it.unit?.toLowerCase().includes(q)
        );
        return matchPoNumber || matchSupplier || matchCreatedBy || matchNotes || matchItems;
      });
    }

    // Sort Urutan
    list.sort((a: any, b: any) => {
      if (poSortBy === "NEWEST") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (poSortBy === "OLDEST") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (poSortBy === "AMOUNT_DESC") {
        return (b.totalAmount || 0) - (a.totalAmount || 0);
      }
      if (poSortBy === "AMOUNT_ASC") {
        return (a.totalAmount || 0) - (b.totalAmount || 0);
      }
      return 0;
    });

    return list;
  }, [initialData.purchaseOrders, orderSubTab, poStatusFilter, poPaymentFilter, poVendorFilter, poSearchQuery, poSortBy]);

  // Handler Buka & Simpan Pembayaran Kasir
  const handleOpenPaymentModal = (po: any) => {
    setPaymentModalPo(po);
    setPaymentForm({
      paymentStatus: (po.paymentStatus as any) || "PAID",
      paidAmount: po.paidAmount !== undefined && po.paidAmount > 0 ? po.paidAmount : po.totalAmount,
      paymentMethod: po.paymentMethod || "TRANSFER_BANK",
      paymentTerms: po.paymentTerms || "TEMPO_30",
      paymentNotes: po.paymentNotes || "",
      paymentProofUrl: po.paymentProofUrl || "",
    });
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalPo) return;
    setIsSubmittingPayment(true);
    try {
      const res = await recordPoPayment({
        poId: paymentModalPo.id,
        paymentStatus: paymentForm.paymentStatus,
        paidAmount: Number(paymentForm.paidAmount),
        paymentMethod: paymentForm.paymentMethod,
        paymentTerms: paymentForm.paymentTerms,
        paymentNotes: paymentForm.paymentNotes,
        paymentRecordedBy: currentStaff?.name || "Kasir Purchasing",
        paymentProofUrl: paymentForm.paymentProofUrl || undefined,
      });
      if (res.success) {
        showMessage("success", res.message || "Status pembayaran berhasil dicatat!");
        setPaymentModalPo(null);
        router.refresh();
      } else {
        showMessage("error", res.error || "Gagal mencatat pembayaran.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan sistem pembayaran.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Handler Kirim PO Resmi ke WhatsApp Vendor
  const handleSendPoWhatsApp = (po: any) => {
    const rawPhone = po.supplierWhatsapp || po.supplierPhone || "";
    const cleanDigits = rawPhone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanDigits.startsWith("0") ? "62" + cleanDigits.slice(1) : cleanDigits;

    let itemsText = "";
    (po.items || []).forEach((it: any, i: number) => {
      itemsText += `  ${i + 1}. *${it.productName}*\n     Jumlah: ${it.quantity} ${it.unit} x ${formatRupiah(it.unitPrice)} = ${formatRupiah(it.subtotal || it.quantity * it.unitPrice)}\n`;
    });

    const termsLabel =
      po.paymentTerms === "CASH"
        ? "Tunai di Muka"
        : po.paymentTerms === "COD"
        ? "Cash on Delivery (COD)"
        : po.paymentTerms === "DP_50"
        ? "Uang Muka 50% (DP 50%)"
        : po.paymentTerms === "TEMPO_60"
        ? "Tempo 60 Hari (Net 60)"
        : "Tempo 30 Hari (Net 30)";

    const msg =
      `*SURAT PURCHASE ORDER (PO) RESMI*\n` +
      `No. PO: *${po.poNumber}*\n` +
      `Tanggal: ${formatDate(po.createdAt)}\n` +
      `Kepada Yth: *${po.supplierName}*\n\n` +
      `Dengan hormat,\n` +
      `Berikut rincian pesanan pengadaan dari kami:\n\n` +
      `${itemsText}\n` +
      `--------------------------------\n` +
      `Subtotal: ${formatRupiah(po.subtotal)}\n` +
      `PPN (${po.taxRate || 12}%): ${formatRupiah(po.tax)}\n` +
      `*TOTAL TAGIHAN: ${formatRupiah(po.totalAmount)}*\n` +
      `Termin Pembayaran: *${termsLabel}*\n` +
      (po.expectedDeliveryDate ? `Estimasi Pengiriman: ${formatDate(po.expectedDeliveryDate)}\n` : "") +
      (po.notes ? `Catatan: ${po.notes}\n` : "") +
      `\nMohon konfirmasi ketersediaan barang dan jadwal pengiriman ke gudang kami. Terima kasih.\n\n` +
      `Hormat kami,\n` +
      `*${po.createdBy}*\n` +
      `Divisi Purchasing & Pengadaan`;

    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  // Memo Komparasi Harga Bahan Baku & Penawaran Vendor
  const filteredVendorPrices = useMemo(() => {
    let list: any[] = [...(initialData.vendorPrices || [])];
    if (priceSearchQuery.trim()) {
      const q = priceSearchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.productName?.toLowerCase().includes(q) ||
          it.vendorName?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.grade?.toLowerCase().includes(q)
      );
    }
    if (priceCategoryFilter !== "ALL") {
      list = list.filter((it) => it.category === priceCategoryFilter);
    }
    if (priceSortBy === "PRICE_ASC") {
      list.sort((a, b) => (a.unitPrice || 0) - (b.unitPrice || 0));
    } else if (priceSortBy === "PRICE_DESC") {
      list.sort((a, b) => (b.unitPrice || 0) - (a.unitPrice || 0));
    } else if (priceSortBy === "LEAD_TIME") {
      list.sort((a, b) => (a.leadTimeDays || 0) - (b.leadTimeDays || 0));
    }
    return list;
  }, [initialData.vendorPrices, priceSearchQuery, priceCategoryFilter, priceSortBy]);

  const uniquePriceCategories = useMemo(() => {
    const set = new Set<string>();
    (initialData.vendorPrices || []).forEach((p: any) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [initialData.vendorPrices]);

  const groupedProductsForCompare = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of filteredVendorPrices) {
      const key = item.productName.trim();
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([productName, quotes]) => {
      const sortedQuotes = [...quotes].sort((a, b) => (a.unitPrice || 0) - (b.unitPrice || 0));
      const minPrice = sortedQuotes[0]?.unitPrice || 0;
      const maxPrice = sortedQuotes[sortedQuotes.length - 1]?.unitPrice || 0;
      const bestVendor = sortedQuotes[0]?.vendorName || "";
      const unit = sortedQuotes[0]?.unit || "unit";
      const category = sortedQuotes[0]?.category || "Bahan Baku";
      return {
        productName,
        category,
        unit,
        minPrice,
        maxPrice,
        bestVendor,
        quotes: sortedQuotes,
      };
    });
  }, [filteredVendorPrices]);

  // Memo & Helper Khusus Fitur Kelola & Pembaruan Harga Vendor
  const vendorsWithPrices = useMemo(() => {
    const list: string[] = [];
    (initialData.vendorPrices || []).forEach((p: any) => {
      if (p.vendorName && !list.includes(p.vendorName)) {
        list.push(p.vendorName);
      }
    });
    (initialData.vendors || []).forEach((v: any) => {
      if (v.name && !list.includes(v.name)) {
        list.push(v.name);
      }
    });
    return list;
  }, [initialData.vendorPrices, initialData.vendors]);

  const vendorProductsForManager = useMemo(() => {
    if (!managerSelectedVendor) return initialData.vendorPrices || [];
    return (initialData.vendorPrices || []).filter(
      (p: any) => p.vendorName === managerSelectedVendor
    );
  }, [initialData.vendorPrices, managerSelectedVendor]);

  const currentManagerItem = useMemo(() => {
    return (initialData.vendorPrices || []).find((p: any) => p.id === managerSelectedPriceId) || null;
  }, [initialData.vendorPrices, managerSelectedPriceId]);

  // Efek inisialisasi default selection di Tab Price Manager
  useEffect(() => {
    if (!managerSelectedPriceId && initialData.vendorPrices && initialData.vendorPrices.length > 0) {
      const first = initialData.vendorPrices[0];
      setManagerSelectedVendor(first.vendorName);
      setManagerSelectedPriceId(first.id);
      setManagerNewPrice(first.unitPrice);
    }
  }, [initialData.vendorPrices, managerSelectedPriceId]);

  // Master List untuk Tabel Kelola Harga Vendor
  const managerTablePrices = useMemo(() => {
    let list: any[] = [...(initialData.vendorPrices || [])];
    if (managerSearchQuery.trim()) {
      const q = managerSearchQuery.toLowerCase().trim();
      list = list.filter(
        (it) =>
          it.productName?.toLowerCase().includes(q) ||
          it.vendorName?.toLowerCase().includes(q) ||
          it.category?.toLowerCase().includes(q) ||
          it.grade?.toLowerCase().includes(q)
      );
    }
    if (managerCategoryFilter !== "ALL") {
      list = list.filter((it) => it.category === managerCategoryFilter);
    }
    return list;
  }, [initialData.vendorPrices, managerSearchQuery, managerCategoryFilter]);

  // Handler Khusus Price Manager
  const handleManagerVendorChange = (vendorName: string) => {
    setManagerSelectedVendor(vendorName);
    const vendorItems = (initialData.vendorPrices || []).filter((p: any) => p.vendorName === vendorName);
    if (vendorItems.length > 0) {
      setManagerSelectedPriceId(vendorItems[0].id);
      setManagerNewPrice(vendorItems[0].unitPrice);
    } else {
      setManagerSelectedPriceId("");
      setManagerNewPrice(0);
    }
  };

  const handleManagerItemChange = (priceId: string) => {
    setManagerSelectedPriceId(priceId);
    const item = (initialData.vendorPrices || []).find((p: any) => p.id === priceId);
    if (item) {
      setManagerNewPrice(item.unitPrice);
      if (item.vendorName !== managerSelectedVendor) {
        setManagerSelectedVendor(item.vendorName);
      }
    }
  };

  const handleSaveManagerPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentManagerItem) {
      showMessage("error", "Pilih bahan baku/item vendor yang ingin diubah harganya.");
      return;
    }
    if (Number(managerNewPrice) <= 0) {
      showMessage("error", "Nominal harga baru harus lebih besar dari 0.");
      return;
    }
    setIsSavingManagerPrice(true);
    try {
      const fullReason = managerNotes.trim() ? `${managerReason} (${managerNotes.trim()})` : managerReason;
      const res = await syncVendorPriceChange({
        id: currentManagerItem.id,
        newPrice: Number(managerNewPrice),
        reason: fullReason,
        updatedBy: currentStaff?.name || "Staf Purchasing",
      });
      if (res.success) {
        showMessage("success", res.message || "Harga vendor berhasil disinkronkan!");
        setManagerNotes("");
        router.refresh();
      } else {
        showMessage("error", res.error || "Gagal menyinkronkan harga vendor.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSavingManagerPrice(false);
    }
  };

  // Memo & Helper Khusus Fitur Riwayat Aktivitas & Audit Log
  const filteredActivityLogs = useMemo(() => {
    let list: any[] = [...(initialData.activityLogs || [])];
    if (historyTypeFilter !== "ALL") {
      list = list.filter((l) => l.type === historyTypeFilter);
    }
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.title?.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q) ||
          l.actor?.toLowerCase().includes(q) ||
          l.actorRole?.toLowerCase().includes(q) ||
          l.referenceId?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [initialData.activityLogs, historyTypeFilter, historySearchQuery]);

  const activityCounts = useMemo(() => {
    const logs = initialData.activityLogs || [];
    return {
      all: logs.length,
      price: logs.filter((l: any) => l.type === "PRICE_UPDATE").length,
      po: logs.filter((l: any) => l.type === "PO_CREATED").length,
      payment: logs.filter((l: any) => l.type === "PAYMENT_RECORDED").length,
      warehouse: logs.filter((l: any) => l.type === "WAREHOUSE_RECEIVED").length,
      vendor: logs.filter((l: any) => l.type === "VENDOR_REGISTERED").length,
      tax: logs.filter((l: any) => l.type === "TAX_SYNC").length,
    };
  }, [initialData.activityLogs]);

  // Handler 1-Klik Pilih Vendor & Bahan Baku untuk Buat PO
  const handleSelectVendorPriceForPO = (item: any) => {
    setNewPoForm({
      supplierName: item.vendorName,
      supplierPhone: item.vendorPhone || "",
      supplierWhatsapp: item.vendorWhatsapp || item.vendorPhone || "",
      supplierAddress: item.vendorAddress || "",
      expectedDeliveryDate: new Date(Date.now() + 86400000 * (item.leadTimeDays || 3)).toISOString().split("T")[0],
      notes: `Pengadaan Bahan Baku: ${item.productName} (Grade: ${item.grade || "Standar"}). Syarat MOQ: ${item.minOrderQty || 1} ${item.unit}. Lead Time: ${item.leadTimeDays || 3} hari.`,
      paymentTerms: item.paymentTerms || "TEMPO_30",
      paymentStatus: "UNPAID",
      paidAmount: 0,
      taxRate: initialData.taxSetting?.rate || 12,
      taxCategory: "STANDAR_12",
      taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
      items: [
        {
          id: `item-${Date.now()}`,
          productId: "",
          productName: item.productName,
          quantity: item.minOrderQty || 1,
          unit: item.unit || "kg",
          unitPrice: Number(item.unitPrice) || 0,
        },
      ],
    });
    setSupplierMatch({
      name: item.vendorName,
      phone: item.vendorPhone,
      whatsapp: item.vendorWhatsapp,
      address: item.vendorAddress,
    });
    setShowCreatePoModal(true);
    showMessage("success", `✓ Vendor "${item.vendorName}" & Bahan Baku "${item.productName}" (${formatRupiah(item.unitPrice)}/${item.unit}) dimuat otomatis!`);
  };

  // Handler Chat Nego via WhatsApp
  const handleSendVendorInquiryWA = (item: any) => {
    const rawPhone = item.vendorWhatsapp || item.vendorPhone || "";
    const cleanDigits = rawPhone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanDigits.startsWith("0") ? "62" + cleanDigits.slice(1) : cleanDigits;

    const msg =
      `Halo Tim Sales/Marketing *${item.vendorName}*,\n\n` +
      `Kami dari Divisi Purchasing PT Sumber Makmur Sentosa.\n` +
      `Kami berminat untuk melakukan pengadaan bahan baku:\n` +
      `• *${item.productName}*\n` +
      `• Spesifikasi/Grade: ${item.grade || "Standar Pabrik"}\n` +
      `• Penawaran Terdaftar: *${formatRupiah(item.unitPrice)} / ${item.unit}*\n` +
      `• Rencana Pembelian (MOQ): ${item.minOrderQty || 1} ${item.unit}\n` +
      `• Termin Pembayaran yang diajukan: ${item.paymentTerms || "Tempo 30 Hari"}\n\n` +
      `Mohon info apakah stok fisik ready dan harga tersebut masih berlaku untuk penerbitan PO minggu ini? Terima kasih.\n\n` +
      `Hormat kami,\n` +
      `*${currentStaff?.name || "Tim Purchasing"}*`;

    const waUrl = formattedPhone
      ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, "_blank");
  };

  // Handler Simpan Penawaran Harga Baru
  const handleSaveVendorPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceForm.productName.trim() || !newPriceForm.vendorName.trim() || Number(newPriceForm.unitPrice) <= 0) {
      showMessage("error", "Nama bahan baku, nama vendor, dan harga satuan valid wajib diisi.");
      return;
    }
    setIsSubmittingPrice(true);
    try {
      const res = await createOrUpdateVendorPrice({
        ...newPriceForm,
        unitPrice: Number(newPriceForm.unitPrice),
        minOrderQty: Number(newPriceForm.minOrderQty),
        leadTimeDays: Number(newPriceForm.leadTimeDays),
      });
      if (res.success) {
        showMessage("success", res.message || "Penawaran harga bahan baku berhasil disimpan!");
        setShowAddPriceModal(false);
        setNewPriceForm({
          productName: "",
          category: "Bahan Baku Plastik",
          vendorName: "",
          vendorPhone: "",
          vendorWhatsapp: "",
          vendorAddress: "",
          unit: "kg",
          unitPrice: 0,
          minOrderQty: 1,
          leadTimeDays: 2,
          paymentTerms: "TEMPO_30",
          grade: "",
          notes: "",
        });
        router.refresh();
      } else {
        showMessage("error", res.error || "Gagal menyimpan penawaran harga.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingPrice(false);
    }
  };

  const handleDeletePriceQuote = async (id: string, name: string) => {
    if (!confirm(`Hapus penawaran harga "${name}"?`)) return;
    try {
      const res = await deleteVendorPrice(id);
      if (res.success) {
        showMessage("success", res.message || "Penawaran harga berhasil dihapus.");
        router.refresh();
      } else {
        showMessage("error", res.error || "Gagal menghapus penawaran.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan.");
    }
  };

  // Handler Buka & Simpan Modal Sinkronisasi Harga Vendor
  const handleOpenSyncPriceModal = (item: any) => {
    setEditSyncPriceItem(item);
    setEditPriceForm({
      newPrice: item.unitPrice,
      reason: "Pembaruan pricelist resmi vendor",
    });
  };

  const handleSaveSyncPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSyncPriceItem) return;
    if (Number(editPriceForm.newPrice) <= 0) {
      showMessage("error", "Nominal harga baru harus lebih besar dari 0.");
      return;
    }
    setIsSubmittingSyncPrice(true);
    try {
      const res = await syncVendorPriceChange({
        id: editSyncPriceItem.id,
        newPrice: Number(editPriceForm.newPrice),
        reason: editPriceForm.reason,
        updatedBy: currentStaff?.name || "Staf Purchasing",
      });
      if (res.success) {
        showMessage("success", res.message || "Harga vendor berhasil disinkronkan!");
        setEditSyncPriceItem(null);
        router.refresh();
      } else {
        showMessage("error", res.error || "Gagal menyinkronkan harga vendor.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan sistem.");
    } finally {
      setIsSubmittingSyncPrice(false);
    }
  };

  // Handler Auto-Detect saat Ketik Nama Perusahaan atau Retail
  const handleSupplierNameChangeInNewPo = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    const matched = allKnownSuppliers.find(
      (s: any) => s.name.trim().toLowerCase() === trimmed
    );

    if (matched && trimmed.length > 0) {
      setNewPoForm((prev) => ({
        ...prev,
        supplierName: val,
        supplierPhone: matched.phone || prev.supplierPhone,
        supplierWhatsapp: matched.whatsapp || matched.phone || prev.supplierWhatsapp,
        supplierAddress: matched.address || prev.supplierAddress,
      }));
      setSupplierMatch(matched);
      setSupplierSuggestions([]);
      showMessage(
        "success",
        `⚡ Auto-Detect: Data kontak & alamat untuk "${matched.name}" terisi otomatis!`
      );
    } else {
      setNewPoForm((prev) => ({
        ...prev,
        supplierName: val,
      }));
      setSupplierMatch(null);

      // Cari sebagian nama jika panjang >= 2
      if (trimmed.length >= 2) {
        const partials = allKnownSuppliers.filter(
          (s: any) =>
            s.name.toLowerCase().includes(trimmed) &&
            s.name.toLowerCase() !== trimmed
        );
        setSupplierSuggestions(partials.slice(0, 3));
      } else {
        setSupplierSuggestions([]);
      }
    }
  };

  const applySupplierToNewPo = (s: any) => {
    setNewPoForm((prev) => ({
      ...prev,
      supplierName: s.name,
      supplierPhone: s.phone || "",
      supplierWhatsapp: s.whatsapp || s.phone || "",
      supplierAddress: s.address || "",
    }));
    setSupplierMatch(s);
    setSupplierSuggestions([]);
    showMessage(
      "success",
      `✓ Data perusahaan "${s.name}" berhasil diisi otomatis!`
    );
  };

  // Form State Vendor Baru
  const [newVendorForm, setNewVendorForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    address: "",
    category: "Material & Logistik",
  });

  // Cek Sesi Login di Browser LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("purchasing_logged_in_staff");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.idCard && parsed.name) {
          const fresh = initialData?.staffList?.find((s: any) => s.idCard === parsed.idCard);
          if (fresh) {
            const hydrated: CurrentStaff = {
              id: fresh.id,
              idCard: fresh.idCard,
              name: fresh.name,
              position: fresh.position,
              role: fresh.role,
              telegramChatId: fresh.telegramChatId,
              telegramUsername: fresh.telegramUsername,
              telegramEnabled: fresh.telegramEnabled,
              dashboardConfigJson: fresh.dashboardConfigJson ?? parsed.dashboardConfigJson ?? null,
            };
            setCurrentStaff(hydrated);
            setActiveTab(parsePurchasingPrefs(hydrated.dashboardConfigJson).defaultTab);
          } else {
            setCurrentStaff(parsed);
            if (parsed.dashboardConfigJson) {
              setActiveTab(parsePurchasingPrefs(parsed.dashboardConfigJson).defaultTab);
            }
          }
        }
      }
    } catch (e) {
      // ignore
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (staffDropdownRef.current && !staffDropdownRef.current.contains(event.target as Node)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handler Login ID Card
  const handleLogin = async (idToUse?: string) => {
    const targetId = (idToUse || loginIdInput).trim();
    if (!targetId) {
      setLoginError("Silakan masukkan Nomor ID Card Anda.");
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await loginStaffWithIdCard(targetId);
      if (!res.success || !res.user) {
        setLoginError(res.error || "Nomor ID Card tidak ditemukan.");
        setIsLoggingIn(false);
        return;
      }
      const loggedStaff: CurrentStaff = {
        id: res.user.id,
        idCard: res.user.idCard,
        name: res.user.name,
        position: res.user.position,
        role: res.user.role,
        telegramChatId: res.user.telegramChatId,
        telegramUsername: res.user.telegramUsername,
        telegramEnabled: res.user.telegramEnabled,
        dashboardConfigJson: res.user.dashboardConfigJson || null,
      };
      setCurrentStaff(loggedStaff);
      localStorage.setItem("purchasing_logged_in_staff", JSON.stringify(loggedStaff));
      setActiveTab(parsePurchasingPrefs(loggedStaff.dashboardConfigJson).defaultTab);
      setLoginIdInput("");
      showMessage("success", `Selamat datang, ${loggedStaff.name}! Login berhasil dengan ID: ${loggedStaff.idCard}`);
    } catch (err: any) {
      setLoginError(err.message || "Gagal memverifikasi login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handler Buka Modal Telegram
  const openTelegramModal = () => {
    if (currentStaff) {
      setTelegramChatIdInput(currentStaff.telegramChatId || "");
      setTelegramUsernameInput(currentStaff.telegramUsername || "");
      setTelegramEnabledInput(Boolean(currentStaff.telegramEnabled));
    }
    setTelegramTestFeedback(null);
    setShowTelegramModal(true);
  };

  // Handler Simpan Telegram Staf ID Card
  const handleSaveStaffTelegram = async () => {
    if (!currentStaff) return;
    setIsSavingTelegram(true);
    setTelegramTestFeedback(null);
    try {
      const res = await updateStaffTelegram(currentStaff.idCard, {
        telegramChatId: telegramChatIdInput,
        telegramUsername: telegramUsernameInput,
        telegramEnabled: telegramEnabledInput,
      });
      if (res.success && res.staff) {
        const updated: CurrentStaff = {
          ...currentStaff,
          telegramChatId: res.staff.telegramChatId,
          telegramUsername: res.staff.telegramUsername,
          telegramEnabled: res.staff.telegramEnabled,
        };
        setCurrentStaff(updated);
        localStorage.setItem("purchasing_logged_in_staff", JSON.stringify(updated));
        showMessage("success", res.message || "Pengaturan Telegram ID Card berhasil disimpan!");
      } else {
        showMessage("error", res.error || "Gagal menyimpan pengaturan Telegram.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan.");
    } finally {
      setIsSavingTelegram(false);
    }
  };

  // Handler Uji Coba Pengiriman Pesan Telegram
  const handleTestStaffTelegram = async () => {
    if (!currentStaff) return;
    const targetChatId = telegramChatIdInput.trim() || currentStaff.telegramChatId;
    if (!targetChatId) {
      setTelegramTestFeedback({
        success: false,
        msg: "Nomor Chat ID Telegram belum diisi. Masukkan Chat ID akun Anda terlebih dahulu.",
      });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramTestFeedback(null);
    try {
      const res = await testStaffTelegramNotification(currentStaff.idCard, targetChatId);
      if (res.success) {
        setTelegramTestFeedback({
          success: true,
          msg: `✓ Pesan uji coba berhasil dikirim ke Chat ID: ${targetChatId}! Periksa aplikasi Telegram Anda.`,
        });
        showMessage("success", "Pesan uji coba Telegram berhasil terkirim!");
      } else {
        setTelegramTestFeedback({
          success: false,
          msg: `Gagal mengirim: ${res.error || "Periksa kembali Chat ID dan token bot Anda."}`,
        });
      }
    } catch (err: any) {
      setTelegramTestFeedback({
        success: false,
        msg: err.message || "Gagal menghubungi server Telegram.",
      });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  // Handler Simpan Konfigurasi Bot Perusahaan
  const handleSaveBotConfig = async () => {
    setIsSavingBotConfig(true);
    try {
      const res = await updateTelegramBotConfig({
        botToken: botTokenInput,
        botUsername: botUsernameInput,
        isActive: botActiveInput,
      });
      if (res.success) {
        showMessage("success", "Konfigurasi Bot Telegram Perusahaan berhasil disimpan!");
      } else {
        showMessage("error", res.error || "Gagal menyimpan konfigurasi Bot.");
      }
    } catch (err: any) {
      showMessage("error", err.message || "Terjadi kesalahan.");
    } finally {
      setIsSavingBotConfig(false);
    }
  };

  // Handler Logout
  const handleLogout = () => {
    void logoutStaffSession();
    setCurrentStaff(null);
    setShowStaffDropdown(false);
    setActiveTab(DEFAULT_PURCHASING_PREFS.defaultTab);
    localStorage.removeItem("purchasing_logged_in_staff");
    showMessage("success", "Anda telah berhasil Log Out dari Sistem Purchasing.");
  };

  // Handler Simpan & Restore Default Tampilan Dashboard Khusus Staf Aktif
  const handleSaveDashboardPrefs = async (nextPrefs: PurchasingDashboardPrefs): Promise<boolean> => {
    if (!currentStaff) return false;
    const res = await saveStaffDashboardPrefs(currentStaff.idCard, JSON.stringify(nextPrefs));
    if (res.success) {
      const updatedStaff: CurrentStaff = {
        ...currentStaff,
        dashboardConfigJson: res.dashboardConfigJson ?? null,
      };
      setCurrentStaff(updatedStaff);
      localStorage.setItem("purchasing_logged_in_staff", JSON.stringify(updatedStaff));
      if (res.prefs?.defaultTab) setActiveTab(res.prefs.defaultTab);
      showMessage("success", res.message || "Tampilan dashboard Anda berhasil disimpan!");
      return true;
    }
    if ((res as { requiresRelogin?: boolean }).requiresRelogin) {
      handleLogout();
    }
    showMessage("error", res.error || "Gagal menyimpan tampilan dashboard.");
    return false;
  };

  const handleResetDashboardPrefs = async (): Promise<boolean> => {
    if (!currentStaff) return false;
    const res = await resetStaffDashboardPrefs(currentStaff.idCard);
    if (res.success) {
      const updatedStaff: CurrentStaff = {
        ...currentStaff,
        dashboardConfigJson: null,
      };
      setCurrentStaff(updatedStaff);
      localStorage.setItem("purchasing_logged_in_staff", JSON.stringify(updatedStaff));
      setActiveTab(DEFAULT_PURCHASING_PREFS.defaultTab);
      showMessage("success", res.message || "Tampilan dashboard dikembalikan ke Default!");
      return true;
    }
    if ((res as { requiresRelogin?: boolean }).requiresRelogin) {
      handleLogout();
    }
    showMessage("error", res.error || "Gagal mengembalikan tampilan default.");
    return false;
  };

  const handleChatbotDashboardAction = async (
    action: ChatbotDashboardAction
  ): Promise<{ success: boolean; message?: string }> => {
    if (!currentStaff?.idCard) {
      return {
        success: false,
        message: "Akses dibatasi: Anda harus login dengan ID Card untuk mengubah dashboard pribadi.",
      };
    }
    if (action.type === "OPEN_CUSTOMIZER") {
      setShowCustomizerModal(true);
      return {
        success: true,
        message: `Panel Pengaturan Background & Tampilan dibuka (${currentStaff.idCard})`,
      };
    }
    if (action.type === "RESET_DEFAULT") {
      const ok = await handleResetDashboardPrefs();
      return {
        success: ok,
        message: ok
          ? `Background & tampilan akun ${currentStaff.idCard} dikembalikan ke Default`
          : "Gagal mengembalikan ke Default (silakan masuk ulang dengan ID Card bila diminta)",
      };
    }
    const patch = action.patch || {};
    const validBannerThemes = new Set<PurchasingThemeColor>(["emerald", "indigo", "slate", "violet"]);
    const nextPrefs: PurchasingDashboardPrefs = {
      ...dashboardPrefs,
      ...(patch.bgPreset !== undefined ? { bgPreset: patch.bgPreset, bgImageData: patch.bgPreset === "custom" ? dashboardPrefs.bgImageData : "" } : {}),
      ...(patch.bgCustomColor !== undefined ? { bgCustomColor: patch.bgCustomColor, bgImageData: "" } : {}),
      ...(patch.bgOverlayOpacity !== undefined ? { bgOverlayOpacity: patch.bgOverlayOpacity } : {}),
      ...(patch.themeColor && validBannerThemes.has(patch.themeColor as PurchasingThemeColor)
        ? { themeColor: patch.themeColor as PurchasingThemeColor }
        : {}),
      ...(patch.compactTable !== undefined ? { compactTable: patch.compactTable } : {}),
      ...(patch.showBanner !== undefined ? { showBanner: patch.showBanner } : {}),
      ...(patch.showStats !== undefined ? { showStats: patch.showStats } : {}),
    };
    const ok = await handleSaveDashboardPrefs(nextPrefs);
    return {
      success: ok,
      message: ok
        ? `Tampilan (${nextPrefs.bgPreset}) diterapkan untuk akun ${currentStaff.name} (${currentStaff.idCard})`
        : "Gagal menerapkan tampilan dashboard (silakan masuk ulang dengan ID Card bila diminta)",
    };
  };

  // Quick Action: Buka Form PO dari Barang Menipis Gudang
  const handleOpenRestockPO = (item: any) => {
    setNewPoForm({
      supplierName: item.preferredSupplier?.name || "",
      supplierPhone: item.preferredSupplier?.phone || "",
      supplierWhatsapp: item.preferredSupplier?.whatsapp || item.preferredSupplier?.phone || "",
      supplierAddress: item.preferredSupplier?.address || "",
      expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      notes: `Restock otomatis: Stok fisik di gudang menipis (Sisa ${item.currentStock} ${item.unit})`,
      paymentTerms: "TEMPO_30",
      paymentStatus: "UNPAID",
      paidAmount: 0,
      taxRate: initialData.taxSetting?.rate || 12,
      taxCategory: "STANDAR_12",
      taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
      items: [
        {
          id: `item-${Date.now()}`,
          productId: item.productId || item.id || "",
          productName: item.productName || item.name || "",
          quantity: item.recommendedReorderQty || 10,
          unit: item.unit || "unit",
          unitPrice: 50000,
        },
      ],
    });
    setSupplierMatch(item.preferredSupplier || null);
    setShowCreatePoModal(true);
  };

  // Quick Action: Ubah PR dari Gudang menjadi PO
  const handleConvertPRToPO = (pr: any) => {
    const prItems = (pr.items || []).map((it: any, i: number) => ({
      id: `item-${Date.now()}-${i}`,
      productId: it.productId || "",
      productName: it.productName || "",
      quantity: Number(it.requestedQty || 10),
      unit: it.unit || "pcs",
      unitPrice: 50000,
    }));

    setNewPoForm({
      supplierName: "",
      supplierPhone: "",
      supplierWhatsapp: "",
      supplierAddress: "",
      expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      notes: `Realisasi Purchase Requisition No: ${pr.prNumber} diajukan oleh ${pr.requestedBy}`,
      paymentTerms: "TEMPO_30",
      paymentStatus: "UNPAID",
      paidAmount: 0,
      taxRate: initialData.taxSetting?.rate || 12,
      taxCategory: "STANDAR_12",
      taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
      items: prItems.length > 0 ? prItems : [
        {
          id: `item-${Date.now()}`,
          productId: "",
          productName: "",
          quantity: 1,
          unit: "pcs",
          unitPrice: 50000,
        },
      ],
    });
    setSupplierMatch(null);
    setShowCreatePoModal(true);
  };

  // Handler Sinkronisasi Pajak Indonesia Langsung dari Portal Resmi (pajak.go.id)
  const handleSyncTax = async () => {
    setIsSyncingTax(true);
    try {
      const res = await syncTaxFromPajakIndonesia();
      if (res.success) {
        showMessage("success", res.message || "Regulasi pajak berhasil disinkronkan!");
        router.refresh();
      } else {
        showMessage("error", res.error || "Gagal sinkronisasi regulasi pajak.");
      }
    } catch (e: any) {
      showMessage("error", e.message || "Gagal menghubungi portal pajak.go.id.");
    } finally {
      setIsSyncingTax(false);
    }
  };

  // Submit Buat PO Multi-Item & Pembayaran
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = newPoForm.items.filter(
      (it) => it.productName.trim().length > 0 && Number(it.quantity) > 0
    );

    if (!newPoForm.supplierName.trim()) {
      showMessage("error", "Nama perusahaan atau retail tempat pembelian wajib diisi.");
      return;
    }

    if (validItems.length === 0) {
      showMessage("error", "Masukkan minimal satu barang dengan nama dan jumlah yang valid di keranjang.");
      return;
    }

    setIsSubmittingPo(true);
    try {
      const created = await createPurchaseOrder({
        supplierName: newPoForm.supplierName,
        supplierPhone: newPoForm.supplierPhone || undefined,
        supplierWhatsapp: newPoForm.supplierWhatsapp || undefined,
        supplierAddress: newPoForm.supplierAddress || undefined,
        orderDate: newPoForm.orderDate || undefined,
        expectedDeliveryDate: newPoForm.expectedDeliveryDate || undefined,
        notes: newPoForm.notes,
        createdBy: currentStaff?.name || "Tim Purchasing",
        taxRate: Number(newPoForm.taxRate),
        taxLegalBasis: newPoForm.taxLegalBasis,
        paymentTerms: newPoForm.paymentTerms,
        paymentStatus: newPoForm.paymentStatus,
        syncPricesToCatalog: syncPriceInCreatePo,
        paidAmount:
          newPoForm.paymentStatus === "PAID"
            ? cartTotal
            : newPoForm.paymentStatus === "PARTIAL"
            ? Math.round(cartTotal * 0.5)
            : 0,
        items: validItems.map((it) => ({
          productId: it.productId,
          productName: it.productName,
          quantity: Number(it.quantity),
          unit: it.unit,
          unitPrice: Number(it.unitPrice),
        })),
      });

      setShowCreatePoModal(false);
      showMessage(
        "success",
        `✓ PO ${created.poNumber} berhasil diterbitkan (${validItems.length} jenis barang, PPN ${created.taxRate || newPoForm.taxRate}% - ${newPoForm.taxLegalBasis}) dan tersinkronisasi ke Gudang!`
      );

      // Reset form ke 1 item baru
      setNewPoForm({
        supplierName: "",
        supplierPhone: "",
        supplierWhatsapp: "",
        supplierAddress: "",
        orderDate: new Date().toISOString().slice(0, 10),
        expectedDeliveryDate: "",
        notes: "",
        paymentTerms: "TEMPO_30",
        paymentStatus: "UNPAID",
        paidAmount: 0,
        taxRate: initialData.taxSetting?.rate || 12,
        taxCategory: "STANDAR_12",
        taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
        items: [
          {
            id: `item-${Date.now()}`,
            productId: "",
            productName: "",
            quantity: 1,
            unit: "pcs",
            unitPrice: 100000,
          },
        ],
      });

      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal menerbitkan Purchase Order.");
    } finally {
      setIsSubmittingPo(false);
    }
  };

  // Submit Tambah Vendor
  const handleCreateVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const v = await createVendor(newVendorForm);
      setShowVendorModal(false);
      setNewVendorForm({ name: "", phone: "", whatsapp: "", address: "", category: "Material & Logistik" });
      showMessage("success", `Vendor "${v.name}" berhasil didaftarkan!`);
      router.refresh();
    } catch (err: any) {
      showMessage("error", err.message || "Gagal mendaftarkan vendor.");
    }
  };

  // Format Rupiah
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatDateTime = (dateVal: any) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (dateVal: any) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  };

  const formatRelativeTime = (dateVal: any) => {
    if (!dateVal) return "-";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "-";
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    if (diffHour < 24) return `${diffHour} jam yang lalu`;
    if (diffDay < 7) return `${diffDay} hari yang lalu`;
    return formatDate(dateVal);
  };

  // Layar Tunggu Pengecekan Sesi
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
          <span className="text-sm font-semibold tracking-wide">Memeriksa Sesi ID Card Purchasing...</span>
        </div>
      </div>
    );
  }

  // LAYAR LOGIN MENGGUNAKAN NOMOR ID CARD (Tanpa Daftar Terbuka)
  if (!currentStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
        {feedbackMsg && (
          <div
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-sm font-medium ${
              feedbackMsg.type === "success" ? "bg-emerald-600 text-white border-emerald-500" : "bg-rose-600 text-white border-rose-500"
            }`}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <div className="w-full max-w-md bg-white text-slate-800 rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 mb-1">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <div>
              <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-[11px] font-bold rounded-full uppercase tracking-wider">
                Sistem Purchasing & Pengadaan
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Login ID Card Purchasing</h1>
            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              Silakan masukkan <strong>Nomor ID Card</strong> resmi divisi Purchasing untuk mengelola Purchase Order dan Pengadaan.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nomor ID Card Staf Purchasing
              </label>
              <div className="relative">
                <CreditCard className="w-5 h-5 absolute left-3.5 top-3 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Contoh: PUR-001, PUR-002, dll."
                  value={loginIdInput}
                  onChange={(e) => {
                    setLoginIdInput(e.target.value.toUpperCase());
                    if (loginError) setLoginError(null);
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 focus:border-emerald-600 focus:bg-white rounded-xl pl-11 pr-3 py-3 text-sm font-mono font-bold tracking-wider uppercase outline-none transition"
                />
              </div>

              {loginError && (
                <div className="mt-2.5 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoggingIn || !loginIdInput.trim()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi ID Card...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  <span>Masuk ke Sistem Purchasing</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400">
              ID Card staf Purchasing diberikan resmi oleh pihak manajemen perusahaan.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen relative transition-colors duration-300 ${bgStyle.containerClass}`}
      style={bgStyle.containerStyle}
    >
      {bgStyle.safeImageUrl && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${bgStyle.safeImageUrl}")` }}
        />
      )}
      {bgStyle.safeImageUrl && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-0 bg-slate-950"
          style={{ opacity: bgStyle.overlayOpacity }}
        />
      )}
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-sm font-medium animate-bounce ${
            feedbackMsg.type === "success" ? "bg-emerald-600 text-white border-emerald-500" : "bg-rose-600 text-white border-rose-500"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Top Navbar Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="bg-emerald-600 text-white p-1.5 rounded-lg shadow-xs flex items-center justify-center">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="font-bold text-base text-slate-900 tracking-tight whitespace-nowrap">
              Purchasing
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 whitespace-nowrap"
              title={`Status koneksi Gudang (${initialData.gudangIntegration.apiUrl}): ${
                initialData.gudangIntegration.connected ? "Terhubung" : "Offline"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  initialData.gudangIntegration.connected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              <span className="hidden sm:inline">Gudang</span>
            </div>

            <button
              type="button"
              onClick={() => setShowTaxModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer whitespace-nowrap transition"
              title="Lihat Regulasi Pajak PPN Indonesia (DJP / Kemenkeu)"
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>PPN {initialData.taxSetting?.rate || 12}%</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNineRouterModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer whitespace-nowrap transition"
              title={
                nineRouterStatus.connected
                  ? "9Router AI Gateway: Terhubung (Port 20128)"
                  : "9Router AI Gateway: Klik untuk menghubungkan"
              }
            >
              <Cpu className="w-3.5 h-3.5 text-violet-600 shrink-0" />
              <span className="hidden md:inline">9Router</span>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  nineRouterStatus.connected ? "bg-emerald-500" : "bg-amber-400"
                }`}
              />
            </button>

            {currentStaff && (
              <button
                type="button"
                onClick={openTelegramModal}
                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer whitespace-nowrap transition"
                title={`Telegram (${currentStaff.idCard}): ${
                  currentStaff.telegramEnabled && currentStaff.telegramChatId ? "Aktif" : "Belum terhubung"
                }`}
              >
                <Send className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Telegram</span>
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    currentStaff.telegramEnabled && currentStaff.telegramChatId ? "bg-emerald-500" : "bg-amber-400"
                  }`}
                />
              </button>
            )}

            {/* User Profile Pill & Dropdown */}
            {currentStaff && (
              <div className="relative" ref={staffDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 pl-1.5 pr-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  title={`${currentStaff.name} (ID: ${currentStaff.idCard})`}
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {currentStaff.name.charAt(0)}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 hidden sm:inline max-w-[120px] truncate">
                    {currentStaff.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {showStaffDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm uppercase">
                          {currentStaff.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-900 truncate">{currentStaff.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{currentStaff.position}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Nomor ID Card:</span>
                        <span className="font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px]">
                          {currentStaff.idCard}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Status Telegram:</span>
                        <span
                          className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                            currentStaff.telegramEnabled && currentStaff.telegramChatId
                              ? "bg-sky-100 text-sky-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {currentStaff.telegramEnabled && currentStaff.telegramChatId ? "Terhubung" : "Belum Aktif"}
                        </span>
                      </div>
                    </div>

                    <div className="px-2 pt-1.5 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowStaffDropdown(false);
                          openTelegramModal();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <Send className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>Koneksi Telegram ({currentStaff.idCard})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowStaffDropdown(false);
                          setShowNineRouterModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <Cpu className="w-4 h-4 text-violet-600 shrink-0" />
                        <span>Pengaturan 9Router AI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowStaffDropdown(false);
                          setShowCustomizerModal(true);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer text-left"
                      >
                        <span className="flex items-center gap-2">
                          <LayoutDashboard className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Atur Tampilan Saya</span>
                        </span>
                        {isDashboardCustomized && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                            Custom
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowStaffDropdown(false);
                          void handleResetDashboardPrefs();
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-left ${
                          isDashboardCustomized
                            ? "text-amber-700 hover:bg-amber-50"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <RotateCcw className={`w-4 h-4 shrink-0 ${isDashboardCustomized ? "text-amber-600" : "text-slate-400"}`} />
                          <span>Restore Default Dashboard</span>
                        </span>
                        {!isDashboardCustomized && (
                          <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                            Default
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border-t border-slate-100"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Log Out (Keluar)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content (Terlindung Error Boundary & Safe-Mode Restore Default Per Staf) */}
      <DashboardErrorBoundary
        userIdCard={currentStaff?.idCard}
        userName={currentStaff?.name}
        resetKey={`${currentStaff?.idCard || "guest"}-${currentStaff?.dashboardConfigJson || "default"}`}
        onRestoreDefault={handleResetDashboardPrefs}
      >
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Banner Hero */}
        {dashboardPrefs.showBanner && (
        <div className={`bg-gradient-to-r ${getPurchasingBannerClass(dashboardPrefs.themeColor)} text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                {dashboardPrefs.customTitle || "Sistem Pengadaan & Purchase Order"}
              </h1>
              <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-md uppercase">
                Enterprise Sync
              </span>
              {isDashboardCustomized && (
                <span className="text-[11px] bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2 py-0.5 rounded-md font-semibold">
                  Custom
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {dashboardPrefs.customTitle ? "Sistem Pengadaan & Purchase Order • " : ""}
              Terhubung langsung dengan Gudang Inventaris • Data barang menipis terdeteksi otomatis • Sinkronisasi PO instan
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCustomizerModal(true)}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
              title="Atur tampilan dashboard pribadi Anda (tidak memengaruhi user lain)"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Atur Tampilan</span>
            </button>
            <button
              type="button"
              onClick={() => void handleResetDashboardPrefs()}
              className={`border px-3 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs ${
                isDashboardCustomized
                  ? "bg-amber-500/25 hover:bg-amber-500/35 border-amber-300/40 text-amber-100"
                  : "bg-white/10 hover:bg-white/20 border-white/20 text-white/90"
              }`}
              title="Kembalikan tampilan dashboard Anda ke bawaan sistem (Restore Default)"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore Default</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setNewPoForm({
                  supplierName: "",
                  supplierPhone: "",
                  supplierWhatsapp: "",
                  supplierAddress: "",
                  expectedDeliveryDate: "",
                  notes: "",
                  paymentTerms: "TEMPO_30",
                  paymentStatus: "UNPAID",
                  paidAmount: 0,
                  taxRate: initialData.taxSetting?.rate || 12,
                  taxCategory: "STANDAR_12",
                  taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
                  items: [
                    {
                      id: "item-1",
                      productId: initialData?.gudangIntegration?.products?.[0]?.id || "",
                      productName: initialData?.gudangIntegration?.products?.[0]?.name || "",
                      quantity: 10,
                      unit: initialData?.gudangIntegration?.products?.[0]?.unit || "unit",
                      unitPrice: 100000,
                    },
                  ],
                });
                setSupplierMatch(null);
                setSupplierSuggestions([]);
                setShowCreatePoModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>+ Terbitkan PO Baru</span>
            </button>

            <button
              type="button"
              onClick={() => setShowTaxModal(true)}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer backdrop-blur-xs"
              title="Periksa Pembaruan Pajak & Sinkronisasi dengan Portal DJP"
            >
              <Landmark className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Regulasi PPN:</span>
              <span className="font-bold">{initialData.taxSetting?.rate || 12}%</span>
            </button>
          </div>
        </div>
        )}

        {/* 5 Stat Cards Finansial & Operasional (Urutan & Visibilitas Sesuai Preferensi Per Staf) */}
        {dashboardPrefs.showStats && (() => {
          const statCardsMap: Record<PurchasingStatKey, React.ReactNode> = {
            totalSpending: (
              <div key="totalSpending" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Total Belanja Pengadaan</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-2 truncate">
                  {formatRupiah(initialData.stats.totalSpending)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Akumulasi seluruh PO resmi</div>
              </div>
            ),
            totalUnpaid: (
              <div key="totalUnpaid" className="bg-white p-4 rounded-xl border border-rose-200/80 bg-rose-50/20 shadow-xs">
                <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
                  <span>Tagihan Belum Lunas (Tempo)</span>
                  <Wallet className="w-4 h-4 text-rose-600" />
                </div>
                <div className="text-base sm:text-lg font-black text-rose-600 mt-2 truncate">
                  {formatRupiah(initialData.stats.totalUnpaid || 0)}
                </div>
                <div className="text-[10px] text-rose-500 mt-1">
                  {initialData.stats.unpaidCount || 0} PO menunggu pembayaran
                </div>
              </div>
            ),
            totalPaid: (
              <div key="totalPaid" className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/20 shadow-xs">
                <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
                  <span>Pembayaran Lunas (Kasir)</span>
                  <Banknote className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-700 mt-2 truncate">
                  {formatRupiah(initialData.stats.totalPaid || 0)}
                </div>
                <div className="text-[10px] text-emerald-600 mt-1">
                  {initialData.stats.paidCount || 0} PO telah dilunasi
                </div>
              </div>
            ),
            receivedCount: (
              <div key="receivedCount" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Kedatangan di Gudang</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-base sm:text-lg font-black text-slate-900 mt-2">
                  {initialData.stats.receivedCount} <span className="text-xs font-normal text-slate-400">/ {initialData.stats.totalPOs} PO</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Stok fisik telah diterima</div>
              </div>
            ),
            lowStockGudang: (
              <div key="lowStockGudang" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Barang Gudang Menipis</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className={`text-base sm:text-lg font-black mt-2 ${initialData.stats.lowStockGudangCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {initialData.stats.lowStockGudangCount} <span className="text-xs font-normal text-slate-500">produk</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">Perlu dibuatkan PO restock</div>
              </div>
            ),
          };
          const activeCards = dashboardPrefs.statOrder.filter((k) => dashboardPrefs.visibleStatKeys[k]);
          if (activeCards.length === 0) return null;
          return (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
              {activeCards.map((k) => statCardsMap[k])}
            </div>
          );
        })()}

        {/* NOTIFIKASI REAL-TIME KEDATANGAN BARANG DARI GUDANG */}
        {dashboardPrefs.showDeliveryAlerts && initialData.deliveryNotifications && initialData.deliveryNotifications.length > 0 && (
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-emerald-500/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md animate-pulse shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base">
                      Konfirmasi Kedatangan: Barang Pesanan Telah Sampai di Gudang!
                    </h3>
                    {initialData.stats.unreadDeliveriesCount > 0 && (
                      <span className="text-[10px] bg-rose-500 text-white font-bold px-2 py-0.5 rounded-full animate-bounce">
                        {initialData.stats.unreadDeliveriesCount} Baru
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-emerald-200">
                    Staf gudang telah memverifikasi fisik barang masuk ke stok gudang dan mengonfirmasi penerimaan PO.
                  </p>
                </div>
              </div>

              {initialData.stats.unreadDeliveriesCount > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    await markAllNotificationsAsRead();
                    router.refresh();
                  }}
                  className="text-xs text-emerald-300 hover:text-white underline cursor-pointer self-start sm:self-auto"
                >
                  Tandai Sudah Dibaca
                </button>
              )}
            </div>

            {/* List Notifikasi */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {initialData.deliveryNotifications.slice(0, 2).map((notif: any) => (
                <div
                  key={notif.id}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded text-[11px]">
                        {notif.poNumber}
                      </span>
                      <span className="font-semibold text-white truncate max-w-[160px]">{notif.supplierName}</span>
                    </div>
                    <p className="text-emerald-100 text-[11px]">
                      🏢 <b>{notif.warehouseName}</b> • Diterima: <b>{notif.receivedBy}</b>
                    </p>
                    <p className="text-[10px] text-emerald-300/90 italic line-clamp-1">
                      "{notif.notes}"
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const matchedPo = initialData.purchaseOrders.find((p: any) => p.poNumber === notif.poNumber);
                      if (matchedPo) {
                        setSelectedDeliveryProof(matchedPo);
                      } else {
                        setSelectedDeliveryProof({
                          poNumber: notif.poNumber,
                          supplierName: notif.supplierName,
                          receivedWarehouse: notif.warehouseName,
                          receivedBy: notif.receivedBy,
                          receivedAt: notif.receivedAt,
                          receiptNotes: notif.notes,
                          receiptPhotoUrl: notif.photoUrl,
                          receiptTimestamp: notif.timestamp,
                          items: [],
                        });
                      }
                    }}
                    className="shrink-0 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shadow-sm flex items-center gap-1 active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Bukti Foto</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback Bar jika Banner disembunyikan agar Atur Tampilan & Restore Default tetap selalu terlihat */}
        {!dashboardPrefs.showBanner && (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <LayoutDashboard className="w-4 h-4 text-indigo-600" />
              <span className="font-semibold text-slate-800">
                {dashboardPrefs.customTitle || "Sistem Pengadaan & Purchase Order"}
              </span>
              {isDashboardCustomized && (
                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                  Custom
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCustomizerModal(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-indigo-600" />
                <span>Atur Tampilan</span>
              </button>
              <button
                type="button"
                onClick={() => void handleResetDashboardPrefs()}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer border ${
                  isDashboardCustomized
                    ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Default</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation - 4 Menu Utama yang Rapi & Bebas Ribet */}
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition cursor-pointer text-center ${
              activeTab === "dashboard"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Boxes className="w-4 h-4 shrink-0" />
            <span className="truncate">1. Ringkasan</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("orders");
              setOrderSubTab("ALL");
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition cursor-pointer text-center ${
              activeTab === "orders" || activeTab === "requisitions"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span className="truncate">2. Pesanan PO &amp; PR</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
              activeTab === "orders" || activeTab === "requisitions" ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700"
            }`}>
              {initialData.stats.totalPOs}
            </span>
            {initialData.stats.pendingPRsGudangCount > 0 && (
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-full animate-pulse shrink-0" title="Ada permintaan barang dari Gudang">
                {initialData.stats.pendingPRsGudangCount} PR
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("vendors");
              setVendorSubTab("catalog");
            }}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition cursor-pointer text-center ${
              activeTab === "vendors" || activeTab === "priceComparison" || activeTab === "priceManager" || activeTab === "gudangCatalog"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <Tag className="w-4 h-4 shrink-0" />
            <span className="truncate">3. Vendor &amp; Harga</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
              activeTab === "vendors" || activeTab === "priceComparison" || activeTab === "priceManager" || activeTab === "gudangCatalog"
                ? "bg-emerald-800 text-white"
                : "bg-slate-100 text-slate-700"
            }`}>
              {initialData.vendorPrices?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition cursor-pointer text-center ${
              activeTab === "history"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span className="truncate">4. Riwayat Aktivitas</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
              activeTab === "history" ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700"
            }`}>
              {initialData.activityLogs?.length || 0}
            </span>
          </button>
        </div>

        {/* TAB 1: DASHBOARD & PENGADAAN CEPAT */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Quick Action Hub - Tombol Pintas Aksi Cepat agar Sangat Mudah Digunakan */}
            {dashboardPrefs.showQuickActions && (
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/80 rounded-2xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Pusat Aksi Cepat Pengadaan (Quick Actions)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pilih aksi yang ingin Anda lakukan secara langsung tanpa navigasi rumit:
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPoForm({
                        supplierName: "",
                        supplierPhone: "",
                        supplierWhatsapp: "",
                        supplierAddress: "",
                        expectedDeliveryDate: "",
                        notes: "",
                        paymentTerms: "TEMPO_30",
                        paymentStatus: "UNPAID",
                        paidAmount: 0,
                        taxRate: initialData.taxSetting?.rate || 12,
                        taxCategory: "STANDAR_12",
                        taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
                        items: [
                          {
                            id: "item-1",
                            productId: initialData?.gudangIntegration?.products?.[0]?.id || "",
                            productName: initialData?.gudangIntegration?.products?.[0]?.name || "",
                            quantity: 10,
                            unit: initialData?.gudangIntegration?.products?.[0]?.unit || "unit",
                            unitPrice: 100000,
                          },
                        ],
                      });
                      setSupplierMatch(null);
                      setSupplierSuggestions([]);
                      setShowCreatePoModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Buat Pesanan (PO)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("vendors");
                      setVendorSubTab("priceManager");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>🏷️ Ubah Harga Vendor</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowVendorModal(true)}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span>+ Daftarkan Vendor Baru</span>
                  </button>
                </div>
              </div>
            </div>
            )}
            {/* Peringatan Barang Menipis dari Gudang */}
            {initialData.gudangIntegration.lowStockItems.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-sm text-slate-900">
                      Peringatan Kritis: Deteksi Stok Barang Menipis dari Sistem Gudang
                    </h3>
                  </div>
                  <span className="text-xs font-bold bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                    {initialData.gudangIntegration.lowStockItems.length} Produk Perlu PO
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {initialData.gudangIntegration.lowStockItems.map((item: any) => (
                    <div key={item.productId} className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-xs text-slate-900">{item.productName}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="font-bold text-rose-600">Sisa: {item.currentStock} {item.unit}</span>
                          <span>•</span>
                          <span>Batas Min: {item.minStock} {item.unit}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                          Vendor: {item.preferredSupplier?.name || "Belum ada vendor tetap"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenRestockPO(item)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span>Buat PO Cepat</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Riwayat PO Terkini */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                    <ShoppingCart className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <span>Purchase Orders (PO) Terkini</span>
                      <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                        {filteredPurchaseOrders.length} dari {initialData.purchaseOrders.length} PO
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Lacak status pesanan pengadaan dan konfirmasi kedatangan di gudang
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isAnyPoFilterActive && (
                    <button
                      type="button"
                      onClick={handleResetPoFilters}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                      title="Reset semua filter PO"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Filter</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>Lihat Semua PO</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>

              {/* Panel Filter PO */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-3">
                {/* Baris 1: Pencarian, Filter Vendor, Sort */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  {/* Search Input */}
                  <div className="md:col-span-6 relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={poSearchQuery}
                      onChange={(e) => setPoSearchQuery(e.target.value)}
                      placeholder="Cari No. PO, nama vendor / retail, atau nama barang..."
                      className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {poSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setPoSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                        title="Hapus pencarian"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Vendor */}
                  <div className="md:col-span-3 relative">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={poVendorFilter}
                      onChange={(e) => setPoVendorFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">🏢 Semua Vendor / Retail</option>
                      {poVendorOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Urutan / Sort */}
                  <div className="md:col-span-3 relative">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={poSortBy}
                      onChange={(e) => setPoSortBy(e.target.value as any)}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="NEWEST">Terbaru (Tanggal)</option>
                      <option value="OLDEST">Terlama (Tanggal)</option>
                      <option value="AMOUNT_DESC">Nominal Tertinggi (Rp)</option>
                      <option value="AMOUNT_ASC">Nominal Terendah (Rp)</option>
                    </select>
                  </div>
                </div>

                {/* Baris 2: Quick Status Filter Pills & Active Filter Tags */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mr-1">
                      <Filter className="w-3 h-3 text-slate-400" />
                      <span>Status Gudang:</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setPoStatusFilter("ALL")}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                        poStatusFilter === "ALL"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Semua ({initialData.purchaseOrders.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setPoStatusFilter("WAITING")}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        poStatusFilter === "WAITING"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>Menunggu ({waitingPoCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPoStatusFilter("RECEIVED")}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        poStatusFilter === "RECEIVED"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Diterima ({receivedPoCount})</span>
                    </button>

                    {/* Filter Pembayaran Kasir */}
                    <span className="text-slate-300 mx-1">|</span>
                    <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                      <Banknote className="w-3 h-3 text-slate-400" />
                      <span>Kasir:</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setPoPaymentFilter("ALL")}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                        poPaymentFilter === "ALL"
                          ? "bg-slate-900 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      Semua
                    </button>

                    <button
                      type="button"
                      onClick={() => setPoPaymentFilter("UNPAID")}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        poPaymentFilter === "UNPAID"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
                      }`}
                    >
                      <span>🔴 Belum Lunas ({initialData.stats.unpaidCount || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPoPaymentFilter("PAID")}
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                        poPaymentFilter === "PAID"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
                      }`}
                    >
                      <span>🟢 Lunas ({initialData.stats.paidCount || 0})</span>
                    </button>
                  </div>

                  {/* Active Filter Tags */}
                  {isAnyPoFilterActive && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <span>Filter aktif:</span>
                      {poSearchQuery && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-medium text-[10px]">
                          Pencarian: "{poSearchQuery}"
                          <button type="button" onClick={() => setPoSearchQuery("")} className="hover:text-emerald-950 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {poVendorFilter !== "ALL" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-medium text-[10px]">
                          Vendor: {poVendorFilter}
                          <button type="button" onClick={() => setPoVendorFilter("ALL")} className="hover:text-blue-950 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {poStatusFilter !== "ALL" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md font-medium text-[10px]">
                          Gudang: {poStatusFilter === "RECEIVED" ? "Sudah Diterima" : "Menunggu Tiba"}
                          <button type="button" onClick={() => setPoStatusFilter("ALL")} className="hover:text-slate-950 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {poPaymentFilter !== "ALL" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-medium text-[10px]">
                          Kasir: {poPaymentFilter === "PAID" ? "Lunas" : "Belum Lunas"}
                          <button type="button" onClick={() => setPoPaymentFilter("ALL")} className="hover:text-amber-950 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                      {poSortBy !== "NEWEST" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-medium text-[10px]">
                          Urutan: {poSortBy === "OLDEST" ? "Terlama" : poSortBy === "AMOUNT_DESC" ? "Nominal Tertinggi" : "Nominal Terendah"}
                          <button type="button" onClick={() => setPoSortBy("NEWEST")} className="hover:text-purple-950 cursor-pointer">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Daftar PO Sesuai Filter */}
              <div className="space-y-2.5">
                {filteredPurchaseOrders.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-300">
                    <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">Tidak ada Purchase Order yang cocok</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-0.5">
                      Tidak ditemukan PO yang sesuai dengan kata kunci pencarian atau kombinasi filter yang dipilih.
                    </p>
                    {isAnyPoFilterActive && (
                      <button
                        type="button"
                        onClick={handleResetPoFilters}
                        className="mt-2.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Semua Filter</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredPurchaseOrders.map((po: any) => (
                    <div key={po.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/60 transition">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-mono font-bold text-xs">
                          {po.poNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-slate-900">{po.supplierName}</p>
                            {/* Badges Pembayaran */}
                            {po.paymentStatus === "PAID" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Lunas</span>
                              </span>
                            ) : po.paymentStatus === "PARTIAL" ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                🟡 DP: {formatRupiah(po.paidAmount || 0)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                🔴 Belum Bayar ({po.paymentTerms || "Tempo 30 Hari"})
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
                              <Calendar className="w-3 h-3 text-emerald-600" />
                              <span>Dibuat: {formatDate(po.createdAt)}</span>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 font-normal">{formatTime(po.createdAt)}</span>
                            </span>
                            {po.status === "RECEIVED" && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-900 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-md shadow-2xs">
                                <Truck className="w-3 h-3 text-sky-600" />
                                <span>Masuk: {formatDate(po.receivedAt)} ({formatTime(po.receivedAt)})</span>
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500">
                              {po.items.length} Barang • Oleh {po.createdBy}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-black text-slate-900">{formatRupiah(po.totalAmount)}</p>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              po.status === "RECEIVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {po.status === "RECEIVED" ? "✓ Diterima Gudang" : "⏳ Menunggu Gudang"}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {/* Tombol Lihat Bukti Foto Kedatangan */}
                          {po.status === "RECEIVED" && (
                            <button
                              type="button"
                              onClick={() => setSelectedDeliveryProof(po)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition"
                              title="Lihat Bukti Foto & Tanggal, Jam:Menit Kedatangan Fisik"
                            >
                              <Camera className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] font-bold">Bukti</span>
                            </button>
                          )}

                          {/* Tombol Kirim WhatsApp */}
                          <button
                            type="button"
                            onClick={() => handleSendPoWhatsApp(po)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition"
                            title="Kirim Format PO Resmi ke WhatsApp Sales Vendor"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold">WA</span>
                          </button>

                          {/* Tombol Catat Pembayaran */}
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(po)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition"
                            title="Pencatatan Kasir & Pembayaran PO"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                            <span className="text-[10px] font-bold">Bayar</span>
                          </button>

                          {/* Tombol Lihat Surat PO */}
                          <button
                            type="button"
                            onClick={() => setPreviewPoModal(po)}
                            className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer"
                            title="Lihat / Cetak Surat PO"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PURCHASE ORDERS (PO) & PERMINTAAN GUDANG */}
        {(activeTab === "orders" || activeTab === "requisitions") && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Daftar Purchase Orders (PO) &amp; Permintaan Gudang</h3>
                <p className="text-xs text-slate-500">Kelola pesanan pembelian vendor, pantau status kedatangan di gudang, dan proses permintaan restock (PR)</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePoModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Terbitkan PO Baru</span>
              </button>
            </div>

            {/* Sub-Filter Segments yang Sangat Mudah */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              <button
                type="button"
                onClick={() => setOrderSubTab("ALL")}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                  orderSubTab === "ALL" && activeTab !== "requisitions"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua Pesanan ({initialData.stats.totalPOs})
              </button>
              <button
                type="button"
                onClick={() => setOrderSubTab("WAITING")}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  orderSubTab === "WAITING"
                    ? "bg-amber-500 text-white shadow-xs"
                    : "text-amber-800 bg-amber-50 hover:bg-amber-100/70"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Menunggu Gudang ({initialData.stats.totalPOs - initialData.stats.receivedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderSubTab("RECEIVED")}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  orderSubTab === "RECEIVED"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Diterima Gudang ({initialData.stats.receivedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderSubTab("UNPAID")}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  orderSubTab === "UNPAID"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-rose-800 bg-rose-50 hover:bg-rose-100/70"
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Belum Lunas ({initialData.stats.unpaidCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setOrderSubTab("PR")}
                className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  orderSubTab === "PR" || activeTab === "requisitions"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-blue-800 bg-blue-50 hover:bg-blue-100/70"
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Permintaan Gudang (PR: {initialData.gudangIntegration.requisitions?.length || 0})</span>
                {initialData.stats.pendingPRsGudangCount > 0 && (
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded text-[10px] font-black">
                    {initialData.stats.pendingPRsGudangCount} Baru
                  </span>
                )}
              </button>
            </div>

            {/* Jika sub-tab PR dipilih: Tampilkan Permintaan Gudang */}
            {(orderSubTab === "PR" || activeTab === "requisitions") ? (
              <div className="space-y-3 pt-2">
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 flex items-center justify-between">
                  <span>Permintaan barang dari sistem Gudang (PR) dapat langsung diproses menjadi PO resmi dalam 1 klik.</span>
                  <span className="font-bold">{initialData.gudangIntegration.requisitions.length} Permintaan</span>
                </div>
                {initialData.gudangIntegration.requisitions.map((pr: any) => (
                  <div key={pr.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          {pr.prNumber}
                        </span>
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                          {pr.urgency}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Diajukan oleh: <b>{pr.requestedBy}</b> • {formatDate(pr.createdAt)}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1">
                        {pr.items.map((it: any, i: number) => (
                          <div key={i} className="text-xs text-slate-700 flex items-center gap-2">
                            <span className="font-bold">• {it.productName}</span>
                            <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] font-semibold">
                              Minta: +{it.requestedQty} {it.unit}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              (Sisa stok gudang: {it.currentStock} {it.unit})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConvertPRToPO(pr)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>Proses Jadi Purchase Order (PO)</span>
                    </button>
                  </div>
                ))}

                {initialData.gudangIntegration.requisitions.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Belum ada Permintaan Pengadaan (PR) dari staf gudang saat ini.
                  </div>
                )}
              </div>
            ) : (
              <>
            {/* Filter & Toolbar Tab PO */}
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-3">
              {/* Baris 1: Pencarian, Filter Vendor, Sort */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                {/* Search Input */}
                <div className="md:col-span-6 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={poSearchQuery}
                    onChange={(e) => setPoSearchQuery(e.target.value)}
                    placeholder="Cari No. PO, nama vendor / retail, atau nama barang..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {poSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPoSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="Hapus pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Vendor */}
                <div className="md:col-span-3 relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={poVendorFilter}
                    onChange={(e) => setPoVendorFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="ALL">🏢 Semua Vendor / Retail</option>
                    {poVendorOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Urutan / Sort */}
                <div className="md:col-span-3 relative">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={poSortBy}
                    onChange={(e) => setPoSortBy(e.target.value as any)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="NEWEST">Terbaru (Tanggal)</option>
                    <option value="OLDEST">Terlama (Tanggal)</option>
                    <option value="AMOUNT_DESC">Nominal Tertinggi (Rp)</option>
                    <option value="AMOUNT_ASC">Nominal Terendah (Rp)</option>
                  </select>
                </div>
              </div>

              {/* Baris 2: Quick Status Filter Pills & Active Filter Tags */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mr-1">
                    <Filter className="w-3 h-3 text-slate-400" />
                    <span>Filter:</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setPoStatusFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      poStatusFilter === "ALL"
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Semua PO ({initialData.purchaseOrders.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoStatusFilter("WAITING")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      poStatusFilter === "WAITING"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    <span>Menunggu Gudang ({waitingPoCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoStatusFilter("RECEIVED")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      poStatusFilter === "RECEIVED"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Diterima Gudang ({receivedPoCount})</span>
                  </button>

                  <span className="h-4 w-px bg-slate-300 mx-1 hidden sm:inline-block" />

                  {/* Filter Status Finansial / Kasir */}
                  <button
                    type="button"
                    onClick={() => setPoPaymentFilter("ALL")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                      poPaymentFilter === "ALL"
                        ? "bg-slate-800 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    Semua Bayar
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoPaymentFilter("UNPAID")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      poPaymentFilter === "UNPAID"
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-white text-rose-700 border border-rose-200 hover:bg-rose-50"
                    }`}
                  >
                    <Wallet className="w-3 h-3" />
                    <span>🔴 Belum Lunas ({initialData.stats.unpaidCount || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPoPaymentFilter("PAID")}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1 ${
                      poPaymentFilter === "PAID"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                    }`}
                  >
                    <Banknote className="w-3 h-3" />
                    <span>🟢 Lunas ({initialData.stats.paidCount || 0})</span>
                  </button>
                </div>

                {/* Active Filter Tags */}
                {isAnyPoFilterActive && (
                  <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <span>Filter aktif:</span>
                    {poSearchQuery && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md font-medium text-[10px]">
                        Pencarian: "{poSearchQuery}"
                        <button type="button" onClick={() => setPoSearchQuery("")} className="hover:text-emerald-950 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {poVendorFilter !== "ALL" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-medium text-[10px]">
                        Vendor: {poVendorFilter}
                        <button type="button" onClick={() => setPoVendorFilter("ALL")} className="hover:text-blue-950 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {poStatusFilter !== "ALL" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md font-medium text-[10px]">
                        Status: {poStatusFilter === "RECEIVED" ? "Sudah Diterima" : "Menunggu Tiba"}
                        <button type="button" onClick={() => setPoStatusFilter("ALL")} className="hover:text-slate-950 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    {poSortBy !== "NEWEST" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-medium text-[10px]">
                        Urutan: {poSortBy === "OLDEST" ? "Terlama" : poSortBy === "AMOUNT_DESC" ? "Nominal Tertinggi" : "Nominal Terendah"}
                        <button type="button" onClick={() => setPoSortBy("NEWEST")} className="hover:text-purple-950 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleResetPoFilters}
                      className="ml-1 text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full text-left text-xs ${dashboardPrefs.compactTable ? "[&_td]:py-1.5 [&_th]:py-2" : ""}`}>
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">No. PO</th>
                    <th className="p-3">
                      <span className="inline-flex items-center gap-1 text-slate-800">
                        <Calendar className="w-3 h-3 text-emerald-600" />
                        <span>Tanggal Dibuat</span>
                      </span>
                    </th>
                    <th className="p-3">Vendor / Pemasok</th>
                    <th className="p-3">
                      <span className="inline-flex items-center gap-1 text-slate-800">
                        <Package className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Nama Item &amp; Kuantitas</span>
                      </span>
                    </th>
                    <th className="p-3 text-right">Total Tagihan</th>
                    <th className="p-3 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-800">
                        <Truck className="w-3.5 h-3.5 text-sky-600" />
                        <span>Tanggal Masuk Barang</span>
                      </span>
                    </th>
                    <th className="p-3 text-center">Status Gudang</th>
                    <th className="p-3 text-center">Status Pembayaran (Kasir)</th>
                    <th className="p-3 text-center">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 px-4">
                        <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-700">Tidak ada Purchase Order yang cocok</p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto mt-0.5">
                          Tidak ditemukan PO yang sesuai dengan kata kunci pencarian atau kombinasi filter yang dipilih.
                        </p>
                        {isAnyPoFilterActive && (
                          <button
                            type="button"
                            onClick={handleResetPoFilters}
                            className="mt-2.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Semua Filter</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredPurchaseOrders.map((po: any) => (
                    <tr key={po.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <span className="font-mono font-bold text-emerald-700 text-xs block">{po.poNumber}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono mt-0.5 inline-block">
                          {po.items.length} Barang
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{formatDate(po.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{formatTime(po.createdAt)}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 font-medium">{formatRelativeTime(po.createdAt)}</span>
                        </div>
                        {po.createdBy && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Oleh: <span className="font-semibold text-slate-700">{po.createdBy}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-medium">
                        <span className="font-bold text-slate-900 block">{po.supplierName}</span>
                        {po.supplierPhone && <span className="text-[10px] text-slate-500">📞 {po.supplierPhone}</span>}
                      </td>
                      <td className="p-3">
                        <div className="space-y-1">
                          {po.items.map((it: any, i: number) => (
                            <div key={i} className="text-xs text-slate-800 flex items-start gap-1">
                              <span className="text-emerald-600 font-bold">•</span>
                              <div>
                                <span className="font-bold text-slate-900">{it.productName}</span>
                                <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded ml-1.5">
                                  {it.quantity} {it.unit}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-900">
                        {formatRupiah(po.totalAmount)}
                        <span className="text-[10px] text-slate-400 block font-normal">
                          {po.taxRate ? `Termasuk PPN ${po.taxRate}%` : "Bebas PPN (0%)"}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        {po.status === "RECEIVED" ? (
                          <div className="inline-flex flex-col items-center">
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{formatDate(po.receivedAt)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded mt-0.5">
                              <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{formatTime(po.receivedAt)}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 mt-0.5">
                              🏢 {po.receivedWarehouse || "Gudang Utama"}
                            </span>
                            {po.receiptPhotoUrl ? (
                              <button
                                type="button"
                                onClick={() => setSelectedDeliveryProof(po)}
                                className="mt-1 text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-md cursor-pointer transition inline-flex items-center gap-1 shadow-2xs"
                                title="Lihat Foto Bukti & Jam:Menit Kedatangan Fisik"
                              >
                                <Camera className="w-3 h-3 text-sky-600" />
                                <span>Bukti Foto</span>
                              </button>
                            ) : (
                              <span className="text-[9px] text-slate-400 mt-0.5">Fisik Terverifikasi</span>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                              Belum Masuk
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {po.expectedDeliveryDate ? `Target: ${formatDate(po.expectedDeliveryDate)}` : "Menunggu Kedatangan"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {po.status === "RECEIVED" ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sudah di Gudang</span>
                            </span>
                            <span className="text-[10px] text-slate-600 font-semibold mt-0.5">
                              🏢 {po.receivedWarehouse || "Gudang Utama"}
                            </span>
                            <span className="text-[9px] text-emerald-700 font-medium">
                              👤 {po.receivedBy || "Staf Gudang"}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Menunggu Tiba</span>
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Sedang Dikirim</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {po.paymentStatus === "PAID" ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>LUNAS (PAID)</span>
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                              {po.paymentMethod === "TRANSFER_BANK"
                                ? "Transfer Bank"
                                : po.paymentMethod === "CASH"
                                ? "Kas / Tunai"
                                : po.paymentMethod || "Lunas"}
                            </span>
                          </div>
                        ) : po.paymentStatus === "PARTIAL" ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              <Receipt className="w-3 h-3 text-amber-600" />
                              <span>DP / SEBAGIAN</span>
                            </span>
                            <span className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                              Dibayar: {formatRupiah(po.paidAmount || 0)}
                            </span>
                            <span className="text-[9px] text-rose-600 font-medium">
                              Sisa: {formatRupiah(Math.max(0, (po.totalAmount || 0) - (po.paidAmount || 0)))}
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                              <Wallet className="w-3 h-3 text-rose-600" />
                              <span>BELUM BAYAR</span>
                            </span>
                            <span className="text-[10px] text-slate-500 mt-0.5 font-medium">
                              {po.paymentTerms === "TEMPO_30"
                                ? "Tempo 30 Hari"
                                : po.paymentTerms === "TEMPO_60"
                                ? "Tempo 60 Hari"
                                : po.paymentTerms === "COD"
                                ? "COD (Saat Tiba)"
                                : po.paymentTerms === "CASH"
                                ? "Tunai Dimuka"
                                : po.paymentTerms || "Net 30"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleSendPoWhatsApp(po)}
                            className="bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition shadow-2xs"
                            title="Kirim PO ke WhatsApp Vendor"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WA</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentModal(po)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition ${
                              po.paymentStatus === "PAID"
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                : "bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 shadow-2xs"
                            }`}
                            title="Catat / Ubah Status Pembayaran Kasir"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>{po.paymentStatus === "PAID" ? "Kasir" : "Bayar"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewPoModal(po)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition"
                            title="Lihat Surat Purchase Order"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>PO</span>
                          </button>
                          {po.status === "RECEIVED" && (
                            <button
                              type="button"
                              onClick={() => setSelectedDeliveryProof(po)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 shadow-xs transition"
                              title="Lihat Bukti Foto & Waktu Kedatangan dari Gudang"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
            </>
            )}
          </div>
        )}

        {/* TAB 3: VENDOR & HARGA BAHAN BAKU (UNIFIED HUB) */}
        {(activeTab === "vendors" || activeTab === "priceComparison" || activeTab === "priceManager" || activeTab === "gudangCatalog") && (
          <div className="space-y-4">
            {/* Sub-Navigasi Bersih & Mudah Dipahami */}
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200/90 shadow-xs grid grid-cols-2 lg:grid-cols-4 gap-1.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setVendorSubTab("catalog")}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer text-center ${
                  vendorSubTab === "catalog"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Scale className="w-4 h-4 shrink-0" />
                <span className="truncate">🔍 Bandingkan Harga</span>
              </button>

              <button
                type="button"
                onClick={() => setVendorSubTab("priceManager")}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer text-center ${
                  vendorSubTab === "priceManager"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200/60"
                }`}
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span className="truncate">✏️ Form Update Harga</span>
              </button>

              <button
                type="button"
                onClick={() => setVendorSubTab("directory")}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer text-center ${
                  vendorSubTab === "directory"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0" />
                <span className="truncate">🏢 Kontak Vendor ({initialData.stats.totalVendors})</span>
              </button>

              <button
                type="button"
                onClick={() => setVendorSubTab("gudangStock")}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl transition cursor-pointer text-center ${
                  vendorSubTab === "gudangStock"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Package className="w-4 h-4 shrink-0" />
                <span className="truncate">📦 Stok Fisik Gudang</span>
              </button>
            </div>

            {/* Sub-View 1: Bandingkan Harga Bahan Baku */}
            {vendorSubTab === "catalog" && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-base text-slate-900">
                    Katalog Bahan Baku &amp; Komparasi Harga Vendor
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cari bahan baku industri, bandingkan penawaran harga resmi antar-supplier, dan terbitkan Purchase Order langsung ke vendor terbaik
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddPriceModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Daftarkan Penawaran Harga Baru</span>
              </button>
            </div>

            {/* Toolbar Filter & Pencarian Bahan Baku */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                {/* Search Bar */}
                <div className="md:col-span-6 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={priceSearchQuery}
                    onChange={(e) => setPriceSearchQuery(e.target.value)}
                    placeholder="Cari nama bahan baku (contoh: Biji Plastik, Pelat Baja, Kabel Tembaga, IPA, Karton)..."
                    className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  {priceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setPriceSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Kategori */}
                <div className="md:col-span-3 relative">
                  <Layers className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={priceCategoryFilter}
                    onChange={(e) => setPriceCategoryFilter(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="ALL">📦 Semua Kategori Bahan Baku</option>
                    {uniquePriceCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Filter */}
                <div className="md:col-span-3 relative">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={priceSortBy}
                    onChange={(e) => setPriceSortBy(e.target.value as any)}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="PRICE_ASC">Harga: Termurah ke Tertinggi</option>
                    <option value="PRICE_DESC">Harga: Tertinggi ke Termurah</option>
                    <option value="LEAD_TIME">Pengiriman: Tercepat (Lead Time)</option>
                  </select>
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Pencarian Cepat:</span>
                {["Biji Plastik HDPE", "Kabel Tembaga", "Pelat Baja", "Isopropyl Alcohol", "Karton Box"].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setPriceSearchQuery(chip)}
                    className={`text-[10px] px-2.5 py-1 rounded-md transition cursor-pointer font-medium ${
                      priceSearchQuery === chip
                        ? "bg-emerald-600 text-white font-bold"
                        : "bg-white text-slate-700 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    🔍 {chip}
                  </button>
                ))}
                {(priceSearchQuery || priceCategoryFilter !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setPriceSearchQuery("");
                      setPriceCategoryFilter("ALL");
                    }}
                    className="text-[10px] text-rose-600 hover:underline font-bold ml-1 cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            {/* Daftar Komparasi Bahan Baku Antar Vendor */}
            <div className="space-y-6">
              {groupedProductsForCompare.length === 0 ? (
                <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Tag className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-sm text-slate-700">Tidak Ada Bahan Baku yang Cocok</h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Tidak ditemukan data penawaran harga vendor yang sesuai dengan pencarian "{priceSearchQuery}". Silakan daftarkan penawaran harga baru atau gunakan kata kunci lain.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddPriceModal(true)}
                    className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Daftarkan Penawaran Harga Baru</span>
                  </button>
                </div>
              ) : (
                groupedProductsForCompare.map((group, gIdx) => (
                  <div
                    key={group.productName || gIdx}
                    className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition"
                  >
                    {/* Header Grup Bahan Baku */}
                    <div className="bg-slate-50/90 border-b border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          <h4 className="font-black text-sm sm:text-base text-slate-900">
                            {group.productName}
                          </h4>
                          <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-md">
                            {group.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Tersedia penawaran dari <b>{group.quotes.length} vendor rekanan</b> resmi terdaftar
                        </p>
                      </div>

                      {/* Best Price Callout */}
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-3.5 py-2 flex items-center gap-3">
                        <Award className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide block">
                            🏷️ Harga Termurah (Best Price):
                          </span>
                          <span className="font-black text-emerald-700 text-sm sm:text-base">
                            {formatRupiah(group.minPrice)}{" "}
                            <span className="text-xs font-normal text-emerald-600">/ {group.unit}</span>
                          </span>
                          <span className="text-[10px] text-emerald-800 block font-medium truncate max-w-[200px]">
                            oleh {group.bestVendor}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Matriks Perbandingan Vendor */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-3">Vendor / Pemasok</th>
                            <th className="p-3">Harga Satuan Resmi</th>
                            <th className="p-3 text-center">Ketentuan Pengadaan (MOQ &amp; Termin)</th>
                            <th className="p-3 text-center">Estimasi Pengiriman</th>
                            <th className="p-3">Spesifikasi / Grade</th>
                            <th className="p-3 text-center">Aksi Cepat Purchasing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.quotes.map((q: any) => {
                            const isCheapest = q.unitPrice === group.minPrice;
                            const diffFromCheapest = q.unitPrice - group.minPrice;
                            return (
                              <tr
                                key={q.id}
                                className={`transition ${
                                  isCheapest ? "bg-emerald-50/30 hover:bg-emerald-50/50" : "hover:bg-slate-50/60"
                                }`}
                              >
                                {/* Vendor Info */}
                                <td className="p-3">
                                  <div className="flex items-start gap-2">
                                    {isCheapest && (
                                      <span
                                        className="mt-0.5 text-emerald-600 shrink-0"
                                        title="Penyedia Harga Termurah"
                                      >
                                        <Award className="w-4 h-4" />
                                      </span>
                                    )}
                                    <div>
                                      <span className="font-bold text-slate-900 block text-xs">
                                        {q.vendorName}
                                      </span>
                                      {q.vendorAddress && (
                                        <span className="text-[10px] text-slate-400 block line-clamp-1 max-w-[220px]">
                                          📍 {q.vendorAddress}
                                        </span>
                                      )}
                                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                        {q.vendorWhatsapp && (
                                          <span className="text-emerald-700 font-mono">
                                            WA: {q.vendorWhatsapp}
                                          </span>
                                        )}
                                        {q.vendorPhone && <span>• Telp: {q.vendorPhone}</span>}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {/* Harga Satuan */}
                                <td className="p-3">
                                  <div>
                                    <span className="font-black text-slate-900 text-sm block">
                                      {formatRupiah(q.unitPrice)}{" "}
                                      <span className="text-[11px] font-normal text-slate-500">/ {q.unit}</span>
                                    </span>

                                    {/* Indikator Fluktuasi Sinkronisasi Harga */}
                                    {q.previousPrice && q.previousPrice !== q.unitPrice && (
                                      <div className="mt-1">
                                        {q.unitPrice > q.previousPrice ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                                            <span>↗️ Naik dari {formatRupiah(q.previousPrice)}</span>
                                            <span>(+{(((q.unitPrice - q.previousPrice) / q.previousPrice) * 100).toFixed(1)}%)</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            <span>↘️ Turun dari {formatRupiah(q.previousPrice)}</span>
                                            <span>({(((q.unitPrice - q.previousPrice) / q.previousPrice) * 100).toFixed(1)}% Hemat)</span>
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      {isCheapest ? (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                          <Check className="w-2.5 h-2.5" />
                                          <span>Paling Murah (Best Price)</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-rose-600 font-semibold block">
                                          + {formatRupiah(diffFromCheapest)} lebih tinggi
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] text-slate-400 block mt-0.5">
                                      Sync: {formatDate(q.updatedAt)} {q.lastUpdatedBy ? `oleh ${q.lastUpdatedBy}` : ""}
                                    </span>
                                  </div>
                                </td>

                                {/* MOQ & Termin */}
                                <td className="p-3 text-center">
                                  <div className="space-y-0.5">
                                    <div className="text-[11px] text-slate-800 font-semibold">
                                      MOQ: {q.minOrderQty || 1} {q.unit}
                                    </div>
                                    <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                      {q.paymentTerms === "TEMPO_30"
                                        ? "Tempo 30 Hari"
                                        : q.paymentTerms === "TEMPO_60"
                                        ? "Tempo 60 Hari"
                                        : q.paymentTerms === "TEMPO_14"
                                        ? "Tempo 14 Hari"
                                        : q.paymentTerms === "COD"
                                        ? "COD"
                                        : q.paymentTerms === "CASH"
                                        ? "Tunai Dimuka"
                                        : q.paymentTerms || "Net 30"}
                                    </span>
                                  </div>
                                </td>

                                {/* Waktu Kirim (Lead Time) */}
                                <td className="p-3 text-center">
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                                    <Zap className="w-3.5 h-3.5 text-blue-600" />
                                    <span>{q.leadTimeDays || 3} Hari</span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 block mt-0.5">Tiba di Gudang</span>
                                </td>

                                {/* Grade / Spesifikasi */}
                                <td className="p-3">
                                  <div className="text-xs">
                                    <span className="font-semibold text-slate-800 block text-[11px]">
                                      {q.grade || "Standar Pabrik"}
                                    </span>
                                    {q.notes && (
                                      <span className="text-[10px] text-slate-500 block italic line-clamp-2 max-w-[200px]">
                                        {q.notes}
                                      </span>
                                    )}
                                    {q.priceChangeReason && (
                                      <span className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded block mt-1 line-clamp-1">
                                        Catatan Harga: {q.priceChangeReason}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Aksi Cepat Purchasing */}
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    {/* Tombol Ubah / Sinkronkan Harga */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSyncPriceModal(q)}
                                      className="bg-amber-50 hover:bg-amber-600 hover:text-white text-amber-800 border border-amber-300 px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 transition shadow-2xs"
                                      title="Ubah & Sinkronkan Harga jika Vendor Mengubah Harga"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Sync Harga</span>
                                    </button>

                                    {/* Riwayat Fluktuasi jika ada */}
                                    {q.priceHistoryJson && (
                                      <button
                                        type="button"
                                        onClick={() => setShowPriceHistoryItem(q)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition"
                                        title="Lihat Riwayat Perubahan Harga Vendor"
                                      >
                                        <History className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Tombol Nego WhatsApp */}
                                    <button
                                      type="button"
                                      onClick={() => handleSendVendorInquiryWA(q)}
                                      className="bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1 transition shadow-2xs"
                                      title="Kirim Chat WhatsApp Nego / Konfirmasi Harga ke Vendor"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span>WA</span>
                                    </button>

                                    {/* Tombol 1-Klik Buat PO Resmi */}
                                    <button
                                      type="button"
                                      onClick={() => handleSelectVendorPriceForPO(q)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition shadow-xs"
                                      title="Terbitkan Purchase Order (PO) langsung dengan vendor dan harga ini"
                                    >
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                      <span>Pilih &amp; PO</span>
                                    </button>

                                    {/* Hapus quote jika perlu */}
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePriceQuote(q.id, `${q.vendorName} - ${q.productName}`)}
                                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                                      title="Hapus penawaran harga ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sub-View 2: Formulir Update Harga Vendor */}
        {vendorSubTab === "priceManager" && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-indigo-800/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">
                      <RotateCcw className="w-5 h-5 text-indigo-400" />
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      Kelola &amp; Pembaruan Harga Vendor
                    </h2>
                    <span className="text-xs bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2.5 py-0.5 rounded-full font-semibold">
                      Fitur Mandiri
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
                    Fitur khusus tersendiri untuk meninjau dan memperbarui harga penawaran dari vendor yang telah tersedia.
                    Perubahan harga otomatis tersinkronisasi ke katalog komparasi belanja dan tercatat ke audit log aktivitas.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPriceModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Tambah Penawaran Baru</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVendorSubTab("catalog")}
                    className="bg-white/10 hover:bg-white/15 text-indigo-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-white/10"
                  >
                    <Scale className="w-4 h-4" />
                    <span>Katalog Komparasi</span>
                  </button>
                </div>
              </div>

              {/* Stat Cards Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-indigo-800/50 text-xs">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-indigo-300 text-[11px] block">Total Penawaran Aktif</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {initialData.vendorPrices?.length || 0} Item
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-indigo-300 text-[11px] block">Vendor Terdaftar</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {vendorsWithPrices.length} Vendor
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-indigo-300 text-[11px] block">Penawaran Terbaik</span>
                  <span className="text-lg font-bold text-emerald-400 mt-0.5 block">
                    {(initialData.vendorPrices || []).filter((p: any) => p.isBestPrice).length} Item
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <span className="text-indigo-300 text-[11px] block">Kategori Bahan Baku</span>
                  <span className="text-lg font-bold text-amber-300 mt-0.5 block">
                    {uniquePriceCategories.length} Kategori
                  </span>
                </div>
              </div>
            </div>

            {/* Workplace: Formulir Mandiri Update Harga Vendor */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Formulir Penyesuaian Harga Satuan Vendor
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pilih vendor rekanan dan bahan baku yang ingin disesuaikan harganya, masukkan nominal baru, lalu sinkronkan.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveManagerPrice} className="space-y-6">
                {/* Langkah 1 & 2: Pemilihan Vendor & Bahan Baku */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>1. Pilih Vendor / Pemasok:</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({vendorsWithPrices.length} vendor tersedia)
                      </span>
                    </label>
                    <select
                      value={managerSelectedVendor}
                      onChange={(e) => handleManagerVendorChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Pilih Vendor --</option>
                      {vendorsWithPrices.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>2. Pilih Bahan Baku / Item dari Vendor:</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({vendorProductsForManager.length} item penawaran)
                      </span>
                    </label>
                    <select
                      value={managerSelectedPriceId}
                      onChange={(e) => handleManagerItemChange(e.target.value)}
                      disabled={vendorProductsForManager.length === 0}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                    >
                      {vendorProductsForManager.length === 0 ? (
                        <option value="">-- Tidak ada item penawaran untuk vendor ini --</option>
                      ) : (
                        vendorProductsForManager.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.productName} ({formatRupiah(p.unitPrice)} / {p.unit})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {/* Ringkasan Penawaran yang Dipilih Saat Ini */}
                {currentManagerItem ? (
                  <div className="bg-slate-50 rounded-2xl border border-slate-200/90 p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            {currentManagerItem.category}
                          </span>
                          {currentManagerItem.isBestPrice && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              <span>Harga Termurah Saat Ini</span>
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">
                          {currentManagerItem.productName}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Pemasok: <b>{currentManagerItem.vendorName}</b> {currentManagerItem.vendorPhone ? `(${currentManagerItem.vendorPhone})` : ""}
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <span className="text-[11px] text-slate-500 block">Harga Satuan Berlaku Saat Ini:</span>
                        <div className="text-lg font-black text-slate-900 mt-0.5">
                          {formatRupiah(currentManagerItem.unitPrice)}
                          <span className="text-xs font-normal text-slate-500 ml-1">/ {currentManagerItem.unit}</span>
                        </div>
                        {currentManagerItem.previousPrice && (
                          <span className="text-[11px] text-slate-400 block line-through">
                            Sebelumnya: {formatRupiah(currentManagerItem.previousPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Minimal Order (MOQ):</span>
                        <span className="font-semibold text-slate-800">
                          {currentManagerItem.minOrderQty || 1} {currentManagerItem.unit}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Lead Time Pengiriman:</span>
                        <span className="font-semibold text-slate-800">
                          {currentManagerItem.leadTimeDays || 1} Hari Kerja
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Termin Pembayaran:</span>
                        <span className="font-semibold text-slate-800">
                          {currentManagerItem.paymentTerms === "COD"
                            ? "Cash on Delivery"
                            : currentManagerItem.paymentTerms === "TEMPO_30"
                            ? "Tempo 30 Hari"
                            : currentManagerItem.paymentTerms === "TEMPO_60"
                            ? "Tempo 60 Hari"
                            : "Tunai / Cash"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Grade / Spesifikasi:</span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {currentManagerItem.grade || "Standar Industri"}
                        </span>
                      </div>
                    </div>

                    {/* Input Harga Baru & Kalkulator Selisih Interaktif */}
                    <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-4 shadow-2xs">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-5 space-y-1.5">
                          <label className="text-xs font-bold text-slate-900 block">
                            Masukkan Harga Satuan Baru (Rp / {currentManagerItem.unit}):
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                            <input
                              type="number"
                              min="1"
                              value={managerNewPrice || ""}
                              onChange={(e) => setManagerNewPrice(Number(e.target.value))}
                              placeholder="Contoh: 27500000"
                              className="w-full pl-9 pr-3 py-2 bg-white border-2 border-indigo-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Kalkulator Selisih Real-Time */}
                        <div className="md:col-span-7">
                          {(() => {
                            const oldP = currentManagerItem.unitPrice || 0;
                            const newP = Number(managerNewPrice) || 0;
                            const diff = newP - oldP;
                            const pct = oldP > 0 ? Number(((diff / oldP) * 100).toFixed(2)) : 0;

                            if (newP <= 0) {
                              return (
                                <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-500">
                                  Silakan masukkan nominal harga baru yang valid di sebelah kiri.
                                </div>
                              );
                            }

                            if (diff < 0) {
                              return (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Penurunan Harga (Penghematan Biaya Pengadaan)</span>
                                    <span className="ml-auto bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                      {pct}%
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-emerald-700">
                                    Harga baru lebih hemat <b>{formatRupiah(Math.abs(diff))}</b> per {currentManagerItem.unit} dibandingkan harga sebelumnya.
                                  </p>
                                </div>
                              );
                            } else if (diff > 0) {
                              return (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                                  <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    <span>Kenaikan Harga Terdeteksi</span>
                                    <span className="ml-auto bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                      +{pct}%
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-amber-700">
                                    Biaya bertambah <b>+{formatRupiah(diff)}</b> per {currentManagerItem.unit}. Pastikan kenaikan telah disesuaikan dengan pricelist resmi vendor.
                                  </p>
                                </div>
                              );
                            } else {
                              return (
                                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600">
                                  Nominal harga baru sama persis dengan harga satuan saat ini ({formatRupiah(oldP)}).
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>

                      {/* Alasan Perubahan Harga (Quick Chips + Input) */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-700 block">
                          Alasan Penyesuaian Harga Vendor:
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            "Pricelist Resmi Kuartal Baru Vendor",
                            "Fluktuasi Nilai Tukar Kurs USD/IDR",
                            "Kenaikan Biaya Logistik & BBM",
                            "Diskon Negosiasi Volume Pembelian",
                            "Penyesuaian Harga Komoditas Global",
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setManagerReason(chip)}
                              className={`text-[11px] px-3 py-1.5 rounded-lg border font-medium transition cursor-pointer ${
                                managerReason === chip
                                  ? "bg-indigo-600 text-white border-indigo-600 font-bold"
                                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {chip}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          value={managerNotes}
                          onChange={(e) => setManagerNotes(e.target.value)}
                          placeholder="Catatan tambahan (misal: Sesuai surat edaran vendor No. 892/MKT/XI/2026)..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      {/* Tombol Eksekusi Update & Sinkronisasi */}
                      <div className="pt-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-slate-400">
                          PIC Pelaksana: <b>{currentStaff?.name || "Staf Purchasing"}</b> ({currentStaff?.role || "Pengadaan"})
                        </span>

                        <button
                          type="submit"
                          disabled={isSavingManagerPrice || Number(managerNewPrice) <= 0}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                        >
                          {isSavingManagerPrice ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Menyimpan &amp; Menyinkronkan...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 text-amber-300" />
                              <span>⚡ Simpan &amp; Sinkronkan Perubahan Harga Vendor</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-xs space-y-2">
                    <Tag className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-semibold text-slate-700">Belum ada bahan baku atau vendor yang dipilih.</p>
                    <p className="text-slate-400 max-w-md mx-auto">
                      Silakan pilih vendor dan bahan baku pada dropdown di atas, atau klik tombol <b>"Ubah Harga"</b> pada tabel daftar harga vendor di bawah ini.
                    </p>
                  </div>
                )}
              </form>
            </div>

            {/* Master Tabel: Semua Harga Penawaran Vendor yang Tersedia */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <span>Daftar Master Harga Bahan Baku Vendor yang Tersedia</span>
                    <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {managerTablePrices.length} Penawaran
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Klik tombol "Ubah Harga" pada baris vendor untuk langsung memuat ke formulir penyesuaian di atas
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={managerSearchQuery}
                      onChange={(e) => setManagerSearchQuery(e.target.value)}
                      placeholder="Cari bahan baku atau vendor..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 sm:w-56"
                    />
                  </div>

                  <select
                    value={managerCategoryFilter}
                    onChange={(e) => setManagerCategoryFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">Semua Kategori</option>
                    {uniquePriceCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tabel */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Bahan Baku &amp; Kategori</th>
                      <th className="py-2.5 px-3">Vendor / Pemasok</th>
                      <th className="py-2.5 px-3">Harga Satuan Saat Ini</th>
                      <th className="py-2.5 px-3">Riwayat Perubahan Terakhir</th>
                      <th className="py-2.5 px-3">Lead Time &amp; Termin</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {managerTablePrices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Tidak ditemukan penawaran vendor yang cocok dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      managerTablePrices.map((item: any) => {
                        const isCurrentActive = managerSelectedPriceId === item.id;
                        let lastHistory: any = null;
                        try {
                          const h = JSON.parse(item.priceHistoryJson || "[]");
                          if (h.length > 0) lastHistory = h[0];
                        } catch {}

                        return (
                          <tr
                            key={item.id}
                            className={`transition hover:bg-slate-50/80 ${
                              isCurrentActive ? "bg-indigo-50/50" : ""
                            }`}
                          >
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900">{item.productName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-600">
                                  {item.category}
                                </span>
                                {item.grade && <span>• {item.grade}</span>}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-semibold text-slate-800">{item.vendorName}</div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {item.vendorPhone || item.vendorWhatsapp || "-"}
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 text-sm">
                                {formatRupiah(item.unitPrice)}
                                <span className="text-slate-500 font-normal text-xs ml-1">/ {item.unit}</span>
                              </div>
                              {item.isBestPrice && (
                                <span className="inline-block mt-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  ★ Harga Terbaik
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              {lastHistory ? (
                                <div className="space-y-0.5 text-[11px]">
                                  <div className="flex items-center gap-1">
                                    <span className="line-through text-slate-400">
                                      {formatRupiah(lastHistory.oldPrice)}
                                    </span>
                                    <span>&rarr;</span>
                                    <span className="font-bold text-slate-800">
                                      {formatRupiah(lastHistory.newPrice)}
                                    </span>
                                    <span
                                      className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                                        lastHistory.diff > 0
                                          ? "bg-amber-100 text-amber-800"
                                          : "bg-emerald-100 text-emerald-800"
                                      }`}
                                    >
                                      {lastHistory.diff > 0 ? `+${lastHistory.percentDiff}%` : `${lastHistory.percentDiff}%`}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 italic truncate max-w-[180px]">
                                    "{lastHistory.reason}"
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400">- Belum ada revisi -</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-[11px] text-slate-600">
                              <div>{item.leadTimeDays || 1} Hari Kerja</div>
                              <div className="text-slate-400 text-[10px] mt-0.5">
                                MOQ: {item.minOrderQty || 1} {item.unit} • {item.paymentTerms || "Tempo"}
                              </div>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setManagerSelectedVendor(item.vendorName);
                                  setManagerSelectedPriceId(item.id);
                                  setManagerNewPrice(item.unitPrice);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                  showMessage("success", `Memuat data "${item.productName}" dari "${item.vendorName}" ke formulir.`);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ml-auto active:scale-95"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Ubah Harga</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Sub-View 3: Direktori Vendor & Rekanan Supplier */}
        {vendorSubTab === "directory" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Direktori Vendor &amp; Rekanan Supplier</h3>
                <p className="text-xs text-slate-500">Daftar pemasok resmi, kontak WhatsApp dan alamat pengiriman</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVendorModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Daftarkan Vendor Baru</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {initialData.vendors.map((v: any) => (
                <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{v.name}</h4>
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded">
                        {v.category || "General"}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{v.address || "Alamat belum diatur"}</span>
                  </p>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 text-xs">
                    {v.whatsapp && (
                      <a
                        href={`https://wa.me/${v.whatsapp.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-2.5 py-1 rounded-lg font-semibold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat WA ({v.whatsapp})</span>
                      </a>
                    )}
                    {v.phone && (
                      <a
                        href={`tel:${v.phone}`}
                        className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1 rounded-lg"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{v.phone}</span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sub-View 4: Katalog Stok Fisik Gudang (Sync) */}
        {vendorSubTab === "gudangStock" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Katalog Stok Fisik Gudang (Sinkron Real-time)</h3>
              <p className="text-xs text-slate-500">
                Data master barang dan ketersediaan stok fisik yang ditarik langsung dari sistem Gudang
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className={`w-full text-left text-xs ${dashboardPrefs.compactTable ? "[&_td]:py-1.5 [&_th]:py-2" : ""}`}>
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Nama Produk &amp; Barcode</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3 text-right">Stok Fisik Gudang</th>
                    <th className="p-3">Pemasok / Vendor Terdaftar</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialData.gudangIntegration.products.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{p.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {p.barcode ? `Barcode: ${p.barcode}` : "Tanpa Barcode"}
                        </span>
                      </td>
                      <td className="p-3">{p.category}</td>
                      <td className="p-3 text-right font-black">
                        <span className={p.isLowStock ? "text-rose-600 font-bold" : "text-slate-900"}>
                          {p.totalStock} {p.unit}
                        </span>
                        <span className="text-[10px] text-slate-400 block font-normal">
                          Min: {p.minStock} {p.unit}
                        </span>
                      </td>
                      <td className="p-3 text-slate-700">
                        {p.supplier?.name || "-"}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.isLowStock ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {p.isLowStock ? "Stok Kritis" : "Aman"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )}

        {/* TAB 4: RIWAYAT AKTIVITAS & AUDIT LOG LENGKAP */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl p-6 shadow-sm border border-blue-900/40">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/30">
                      <History className="w-5 h-5 text-blue-400" />
                    </span>
                    <h2 className="text-xl font-bold tracking-tight text-white">
                      Riwayat Aktivitas &amp; Audit Log Lengkap
                    </h2>
                    <span className="text-xs bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2.5 py-0.5 rounded-full font-semibold">
                      Audit Trail
                    </span>
                  </div>
                  <p className="text-xs text-blue-200/80 max-w-2xl leading-relaxed">
                    Seluruh jejak transaksi, penyesuaian harga vendor, pencatatan pembayaran kasir, verifikasi barang gudang,
                    dan sinkronisasi pajak DJP tercatat secara kronologis untuk kepatuhan tata kelola (governance) dan transparansi pengadaan.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.refresh()}
                    className="bg-white/10 hover:bg-white/15 text-blue-200 px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer border border-white/10"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Segarkan Log</span>
                  </button>
                </div>
              </div>

              {/* Stat Summary Row */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 mt-5 pt-4 border-t border-blue-900/50 text-xs">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-blue-300 text-[10px] block">Semua Log</span>
                  <span className="text-base font-bold text-white mt-0.5 block">{activityCounts.all}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-indigo-300 text-[10px] block">Update Harga</span>
                  <span className="text-base font-bold text-indigo-300 mt-0.5 block">{activityCounts.price}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-blue-300 text-[10px] block">Purchase Order</span>
                  <span className="text-base font-bold text-blue-300 mt-0.5 block">{activityCounts.po}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-emerald-300 text-[10px] block">Pembayaran</span>
                  <span className="text-base font-bold text-emerald-300 mt-0.5 block">{activityCounts.payment}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-amber-300 text-[10px] block">Gudang</span>
                  <span className="text-base font-bold text-amber-300 mt-0.5 block">{activityCounts.warehouse}</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-cyan-300 text-[10px] block">Pajak DJP</span>
                  <span className="text-base font-bold text-cyan-300 mt-0.5 block">{activityCounts.tax}</span>
                </div>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Filter Tabs Chips */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("ALL")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                      historyTypeFilter === "ALL"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Semua ({activityCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("PRICE_UPDATE")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                      historyTypeFilter === "PRICE_UPDATE"
                        ? "bg-indigo-600 text-white"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    <span>Update Harga ({activityCounts.price})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("PO_CREATED")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                      historyTypeFilter === "PO_CREATED"
                        ? "bg-blue-600 text-white"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Purchase Order ({activityCounts.po})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("PAYMENT_RECORDED")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                      historyTypeFilter === "PAYMENT_RECORDED"
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Pembayaran ({activityCounts.payment})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("WAREHOUSE_RECEIVED")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                      historyTypeFilter === "WAREHOUSE_RECEIVED"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>Gudang ({activityCounts.warehouse})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTypeFilter("TAX_SYNC")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1 ${
                      historyTypeFilter === "TAX_SYNC"
                        ? "bg-cyan-700 text-white"
                        : "bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    <span>Pajak DJP ({activityCounts.tax})</span>
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Cari aktivitas, vendor, staf, atau No PO..."
                    className="pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
                  />
                  {historySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setHistorySearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List Stream Card Riwayat Aktivitas */}
            <div className="space-y-3">
              {filteredActivityLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-2">
                  <History className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-bold text-slate-700 text-sm">Tidak ada riwayat aktivitas yang cocok</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Coba ganti filter kategori aktivitas atau reset kata kunci pencarian.
                  </p>
                </div>
              ) : (
                filteredActivityLogs.map((log: any) => {
                  let meta: any = null;
                  try {
                    if (log.metadataJson) meta = JSON.parse(log.metadataJson);
                  } catch {}

                  // Tentukan Style Icon & Accent berdasarkan Tipe
                  let typeBadge = {
                    label: "Aktivitas",
                    bg: "bg-slate-100 text-slate-700 border-slate-200",
                    borderLeft: "border-l-slate-400",
                    icon: <History className="w-4 h-4 text-slate-600" />,
                  };

                  if (log.type === "PRICE_UPDATE") {
                    typeBadge = {
                      label: "Pembaruan Harga",
                      bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
                      borderLeft: "border-l-indigo-600",
                      icon: <Tag className="w-4 h-4 text-indigo-600" />,
                    };
                  } else if (log.type === "PO_CREATED") {
                    typeBadge = {
                      label: "Purchase Order",
                      bg: "bg-blue-50 text-blue-700 border-blue-200",
                      borderLeft: "border-l-blue-600",
                      icon: <ShoppingCart className="w-4 h-4 text-blue-600" />,
                    };
                  } else if (log.type === "PAYMENT_RECORDED") {
                    typeBadge = {
                      label: "Pembayaran Kasir",
                      bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      borderLeft: "border-l-emerald-600",
                      icon: <Banknote className="w-4 h-4 text-emerald-600" />,
                    };
                  } else if (log.type === "WAREHOUSE_RECEIVED") {
                    typeBadge = {
                      label: "Kedatangan Gudang",
                      bg: "bg-amber-50 text-amber-700 border-amber-200",
                      borderLeft: "border-l-amber-600",
                      icon: <Warehouse className="w-4 h-4 text-amber-600" />,
                    };
                  } else if (log.type === "VENDOR_REGISTERED") {
                    typeBadge = {
                      label: "Vendor Baru",
                      bg: "bg-purple-50 text-purple-700 border-purple-200",
                      borderLeft: "border-l-purple-600",
                      icon: <Building2 className="w-4 h-4 text-purple-600" />,
                    };
                  } else if (log.type === "TAX_SYNC") {
                    typeBadge = {
                      label: "Regulasi Pajak DJP",
                      bg: "bg-cyan-50 text-cyan-800 border-cyan-200",
                      borderLeft: "border-l-cyan-600",
                      icon: <Landmark className="w-4 h-4 text-cyan-700" />,
                    };
                  }

                  return (
                    <div
                      key={log.id}
                      className={`bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 border-l-4 ${typeBadge.borderLeft} transition hover:shadow-xs space-y-2`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg border flex items-center justify-center ${typeBadge.bg}`}>
                            {typeBadge.icon}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${typeBadge.bg}`}>
                            {typeBadge.label}
                          </span>
                          <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                            {log.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-700">{formatRelativeTime(log.createdAt)}</span>
                          <span className="text-slate-300">•</span>
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed pl-8">
                        {log.description}
                      </p>

                      {/* Detail Pelaku & Metadata */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 pl-8 text-xs">
                        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                          <span className="font-semibold text-slate-700">Pelaku:</span>
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-medium text-slate-800">
                            👤 {log.actor} ({log.actorRole || "Staf Pengadaan"})
                          </span>
                          {log.referenceId && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                                Ref: {log.referenceId}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Tombol Interaktif Sesuai Tipe */}
                        <div className="flex items-center gap-2">
                          {log.type === "PRICE_UPDATE" && (
                            <button
                              type="button"
                              onClick={() => {
                                if (log.referenceId) {
                                  setManagerSelectedVendor(log.referenceId);
                                }
                                setActiveTab("vendors");
                                setVendorSubTab("priceManager");
                              }}
                              className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <span>Buka Kelola Harga</span>
                              <span>&rarr;</span>
                            </button>
                          )}

                          {log.type === "PO_CREATED" && log.referenceId && (
                            <button
                              type="button"
                              onClick={() => {
                                const matchedPo = initialData.purchaseOrders.find((p: any) => p.poNumber === log.referenceId);
                                if (matchedPo) {
                                  setPreviewPoModal(matchedPo);
                                } else {
                                  setActiveTab("orders");
                                }
                              }}
                              className="text-[11px] text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Lihat Detail PO</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>
      </DashboardErrorBoundary>

      {/* MODAL 1: FORM TERBITKAN PURCHASE ORDER (PO) BARU */}
      {showCreatePoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setShowCreatePoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Terbitkan Purchase Order (PO) Resmi</h3>
              <p className="text-xs text-slate-500">
                Pesanan akan otomatis tersinkronisasi ke sistem Gudang agar siap diterima saat barang tiba.
              </p>
            </div>

            <form onSubmit={handleCreatePoSubmit} className="space-y-4">
              {/* BAGIAN 1: INFORMASI TEMPAT PEMBELIAN (PERUSAHAAN / RETAIL / TOKO) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Store className="w-4 h-4 text-emerald-600" />
                    <span>Informasi Tempat Pembelian (Perusahaan / Retail / Toko)</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    Auto-Detect Aktif
                  </span>
                </div>

                {/* Kolom Nama Perusahaan atau Retail Tempat Pembelian */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Perusahaan atau Retail Tempat Pembelian *
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      list="purchasing-vendors-datalist"
                      placeholder="Contoh: PT Distributor Sentosa, Toko Berkah Glodok, Indomaret..."
                      value={newPoForm.supplierName}
                      onChange={(e) => handleSupplierNameChangeInNewPo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                    />
                    <datalist id="purchasing-vendors-datalist">
                      {allKnownSuppliers.map((v: any) => (
                        <option key={v.id} value={v.name}>
                          {v.phone ? `HP: ${v.phone}` : ""} {v.address ? `• ${v.address}` : ""}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Indikator Jika Perusahaan Terdeteksi */}
                  {supplierMatch && (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-[11px] animate-fadeIn">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        <strong>Perusahaan Terdeteksi:</strong> Nomor HP, WhatsApp, dan Alamat terisi otomatis.
                      </span>
                    </div>
                  )}

                  {/* Rekomendasi jika sebagian nama cocok */}
                  {supplierSuggestions.length > 0 && (
                    <div className="mt-1.5 p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Ditemukan perusahaan tersimpan yang cocok:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {supplierSuggestions.map((s: any) => (
                          <button
                            key={s.name}
                            type="button"
                            onClick={() => applySupplierToNewPo(s)}
                            className="text-[11px] bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-700 px-2.5 py-1 rounded-md transition font-medium cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <span>⚡ Isi Otomatis: {s.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chips Perusahaan Tersimpan (Pilih Cepat) */}
                  {allKnownSuppliers.length > 0 && !supplierMatch && supplierSuggestions.length === 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <span className="text-[10px] text-slate-400">Pilih Cepat:</span>
                      {allKnownSuppliers.slice(0, 4).map((s: any) => (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => applySupplierToNewPo(s)}
                          className="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-slate-600 truncate max-w-[170px]"
                          title={`${s.name} (${s.phone || "No HP"} • ${s.address || "Alamat"})`}
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Kolom Nomor Handphone & WhatsApp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor Handphone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="tel"
                        placeholder="Contoh: 0812-3456-7890"
                        value={newPoForm.supplierPhone}
                        onChange={(e) => setNewPoForm({ ...newPoForm, supplierPhone: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Nomor WhatsApp
                      </label>
                      {newPoForm.supplierPhone && (
                        <button
                          type="button"
                          onClick={() => setNewPoForm({ ...newPoForm, supplierWhatsapp: newPoForm.supplierPhone })}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold cursor-pointer"
                        >
                          Samakan dengan HP
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <MessageCircle className="w-4 h-4 absolute left-3 top-2.5 text-emerald-500 pointer-events-none" />
                      <input
                        type="tel"
                        placeholder="Contoh: 0812-3456-7890 (Direct WA)"
                        value={newPoForm.supplierWhatsapp}
                        onChange={(e) => setNewPoForm({ ...newPoForm, supplierWhatsapp: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Kolom Maps atau Kolom Alamat Perusahaan / Retail Tempat Pembelian */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Maps atau Kolom Alamat Perusahaan / Retail Tempat Pembelian
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-rose-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Alamat lengkap (contoh: Jl. Sudirman No. 10 Jakarta) ATAU link Google Maps (https://maps.app.goo.gl/...)"
                      value={newPoForm.supplierAddress}
                      onChange={(e) => setNewPoForm({ ...newPoForm, supplierAddress: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Ketik alamat fisik toko/retail atau tempelkan tautan Google Maps untuk navigasi instan.
                  </span>

                  {/* Preview Peta Langsung saat Mengetik Alamat / Link */}
                  {newPoForm.supplierAddress && newPoForm.supplierAddress.trim().length > 2 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        <span>Peta Lokasi Toko / Retail (Tampil Otomatis):</span>
                      </span>
                      <div className="rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                        <LocationMapEmbed
                          address={newPoForm.supplierAddress}
                          name={newPoForm.supplierName || "Lokasi Vendor"}
                          height="180px"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BAGIAN 2: KERANJANG MULTI-BARANG YANG DIPESAN */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Barang yang Dipesan (Multi-Item Keranjang)</span>
                  </div>
                  <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    {newPoForm.items.length} Jenis Barang
                  </span>
                </div>

                <div className="space-y-2.5">
                  {newPoForm.items.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <span>Barang #{idx + 1}</span>
                        </span>
                        {newPoForm.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1 rounded-md transition cursor-pointer text-xs flex items-center gap-1"
                            title="Hapus baris barang ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Hapus</span>
                          </button>
                        )}
                      </div>

                      {/* Input Nama Barang */}
                      <div>
                        <div className="relative">
                          <Package className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            required
                            list="gudang-products-datalist"
                            placeholder="Ketik atau pilih nama barang (contoh: Laptop ThinkPad T14, Kabel Tembaga...)"
                            value={it.productName}
                            onChange={(e) => updateItemRow(idx, "productName", e.target.value)}
                            className="w-full bg-slate-50/60 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-emerald-500 focus:bg-white font-medium"
                          />
                        </div>

                        {/* Chips Cepat dari Katalog Gudang */}
                        {initialData.gudangIntegration.products.length > 0 && !it.productName && (
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
                            <span>Katalog Gudang:</span>
                            {initialData.gudangIntegration.products.slice(0, 3).map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleSelectProductForItem(idx, p)}
                                className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] transition cursor-pointer"
                              >
                                + {p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Satuan, Qty, Harga Satuan, dan Subtotal */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">Satuan</label>
                          <input
                            type="text"
                            list="purchasing-units-datalist"
                            required
                            placeholder="unit, pcs..."
                            value={it.unit}
                            onChange={(e) => updateItemRow(idx, "unit", e.target.value)}
                            className="w-full bg-slate-50/60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 focus:bg-white font-medium"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">Jumlah (Qty)</label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={it.quantity}
                            onChange={(e) => updateItemRow(idx, "quantity", Number(e.target.value))}
                            className="w-full bg-slate-50/60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 focus:bg-white font-bold"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">Harga Satuan (Rp)</label>
                          <input
                            type="number"
                            min="0"
                            required
                            value={it.unitPrice}
                            onChange={(e) => updateItemRow(idx, "unitPrice", Number(e.target.value))}
                            className="w-full bg-slate-50/60 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 focus:bg-white font-bold"
                          />
                        </div>

                        <div className="sm:col-span-3 bg-slate-50 rounded-lg p-1.5 border border-slate-100 flex flex-col justify-center text-right">
                          <span className="text-[9px] text-slate-400">Subtotal Baris:</span>
                          <span className="font-bold text-slate-900 text-xs truncate">
                            {formatRupiah((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addItemRow}
                    className="w-full py-2 bg-white hover:bg-emerald-50 border border-dashed border-emerald-400 text-emerald-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Tambah Barang Lagi ke PO Ini</span>
                  </button>

                  {/* Toggle Sinkronisasi Harga ke Katalog Rekanan */}
                  <div className="pt-1">
                    <label className="flex items-center gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncPriceInCreatePo}
                        onChange={(e) => setSyncPriceInCreatePo(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600 shrink-0"
                      />
                      <span>
                        <b>⚡ Sinkronkan Harga ke Katalog Vendor:</b> Jika harga satuan yang Anda ketik di PO ini berbeda dari katalog, sistem akan otomatis memperbarui data harga resmi vendor tersebut.
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* BAGIAN 3: KETENTUAN PEMBAYARAN KASIR & TERMIN (PAYMENT TERMS) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <span>Ketentuan Pembayaran Kasir / Finansial</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                    Termin &amp; Kasir
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Termin Pembayaran (Payment Terms) *
                    </label>
                    <select
                      value={newPoForm.paymentTerms}
                      onChange={(e) => setNewPoForm({ ...newPoForm, paymentTerms: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium cursor-pointer"
                    >
                      <option value="TEMPO_30">Tempo 30 Hari (Net 30) - Standar PO</option>
                      <option value="TEMPO_60">Tempo 60 Hari (Net 60)</option>
                      <option value="TEMPO_14">Tempo 14 Hari (Net 14)</option>
                      <option value="CASH">Tunai di Muka (Cash)</option>
                      <option value="COD">Cash on Delivery (Bayar saat Barang Tiba)</option>
                      <option value="DP_50">Uang Muka 50% (DP 50%)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Status Pembayaran Awal *
                    </label>
                    <select
                      value={newPoForm.paymentStatus}
                      onChange={(e) => setNewPoForm({ ...newPoForm, paymentStatus: e.target.value as any })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium cursor-pointer"
                    >
                      <option value="UNPAID">🔴 Belum Dibayar (Menunggu Invoice / Jatuh Tempo)</option>
                      <option value="PAID">🟢 Langsung Lunas Penuh (PAID)</option>
                      <option value="PARTIAL">🟡 Pembayaran Uang Muka / DP (PARTIAL)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* BAGIAN 4: KALKULASI BIAYA & TARIF PPN RESMI INDONESIA (pajak.go.id) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Landmark className="w-4 h-4 text-emerald-700" />
                    <span>Ketentuan Pajak (PPN) Resmi Indonesia (pajak.go.id)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTaxModal(true)}
                    className="text-[10px] text-emerald-800 bg-emerald-100 hover:bg-emerald-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer transition self-start sm:self-auto"
                  >
                    <ShieldCheck className="w-3 h-3 text-emerald-700" />
                    <span>Regulasi DJP &amp; Kemenkeu</span>
                  </button>
                </div>

                {/* Pilihan Kategori PPN Resmi */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pilih Skema Tarif PPN yang Dikenakan:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewPoForm({
                          ...newPoForm,
                          taxRate: 12,
                          taxCategory: "STANDAR_12",
                          taxLegalBasis: "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        newPoForm.taxRate === 12
                          ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">PPN 12%</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          UU HPP
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        Tarif standar nasional barang kena pajak reguler
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNewPoForm({
                          ...newPoForm,
                          taxRate: 11,
                          taxCategory: "EFEKTIF_11",
                          taxLegalBasis: "PMK No. 131 Tahun 2024 (DPP Nilai Lain 11/12)",
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        newPoForm.taxRate === 11
                          ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">PPN 11%</span>
                        <span className="text-[9px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded">
                          PMK-131
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        Formula DPP Nilai Lain untuk barang/jasa non-mewah
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setNewPoForm({
                          ...newPoForm,
                          taxRate: 0,
                          taxCategory: "BEBAS_0",
                          taxLegalBasis: "Pasal 4A & 16B UU PPN (Fasilitas Bebas PPN)",
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        newPoForm.taxRate === 0
                          ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900">Bebas 0%</span>
                        <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                          Fasilitas
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                        Bahan pokok, fasilitas pendidikan/kesehatan
                      </p>
                    </button>
                  </div>
                </div>

                {/* Rincian Kalkulasi Pajak Multi-Item */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({newPoForm.items.length} Barang):</span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(cartSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span className="flex items-center gap-1">
                      <span>PPN ({newPoForm.taxRate}%):</span>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        [{newPoForm.taxLegalBasis || "UU HPP"}]
                      </span>
                    </span>
                    <span className="font-bold text-slate-800">
                      {formatRupiah(cartTax)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-black text-emerald-700">
                    <span>Total Tagihan (Termasuk PPN):</span>
                    <span>
                      {formatRupiah(cartTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tanggal Pembuatan PO *</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newPoForm.orderDate}
                    onChange={(e) => setNewPoForm({ ...newPoForm, orderDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Tanggal resmi PO diterbitkan
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Estimasi Tanggal Kirim</span>
                  </label>
                  <input
                    type="date"
                    value={newPoForm.expectedDeliveryDate}
                    onChange={(e) => setNewPoForm({ ...newPoForm, expectedDeliveryDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Target kedatangan di gudang
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Pesanan</label>
                <textarea
                  rows={2}
                  placeholder="Instruksi pengiriman, syarat pembayaran, dll."
                  value={newPoForm.notes}
                  onChange={(e) => setNewPoForm({ ...newPoForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreatePoModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPo}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingPo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Terbitkan & Kirim ke Gudang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DETAIL & PREVIEW SURAT PESANAN (PO) FORMAL */}
      {previewPoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setPreviewPoModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Surat PO */}
            <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">PURCHASE ORDER</h2>
                <p className="text-xs font-mono font-bold text-emerald-700">{previewPoModal.poNumber}</p>
                <p className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tanggal Dibuat: <b className="text-slate-900">{formatDate(previewPoModal.createdAt)}</b> ({formatTime(previewPoModal.createdAt)})</span>
                </p>
              </div>
              <div className="text-right">
                <span className="font-bold text-sm text-slate-800 block">Divisi Purchasing</span>
                <span className="text-[11px] text-slate-500">PT Sumber Makmur Sentosa</span>
              </div>
            </div>

            {/* Data Vendor */}
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kepada Vendor:</span>
                <p className="font-bold text-slate-900 text-sm">{previewPoModal.supplierName}</p>
                <p className="text-slate-500 mt-0.5">{previewPoModal.supplierAddress || "Alamat tidak dicantumkan"}</p>
                {previewPoModal.supplierPhone && <p className="text-slate-500">📞 {previewPoModal.supplierPhone}</p>}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tujuan Pengiriman:</span>
                <p className="font-bold text-slate-900">Gudang Utama (WH-JKT-01)</p>
                <p className="text-slate-500">Kawasan Industri Pulogadung, Jakarta Timur</p>
              </div>
            </div>

            {/* Tabel Item */}
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Deskripsi Barang</th>
                  <th className="p-2.5 text-center">Jumlah</th>
                  <th className="p-2.5 text-right">Harga Satuan</th>
                  <th className="p-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewPoModal.items.map((it: any, i: number) => (
                  <tr key={i}>
                    <td className="p-2.5 font-medium">{it.productName}</td>
                    <td className="p-2.5 text-center font-bold">{it.quantity} {it.unit}</td>
                    <td className="p-2.5 text-right">{formatRupiah(it.unitPrice || 0)}</td>
                    <td className="p-2.5 text-right font-bold">{formatRupiah(it.subtotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Total Section */}
            <div className="border-t border-slate-200 pt-3 flex justify-end text-xs">
              <div className="w-64 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span className="font-bold">{formatRupiah(previewPoModal.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    PPN ({previewPoModal.taxRate !== undefined ? previewPoModal.taxRate : 11}%):
                  </span>
                  <span className="font-bold">{formatRupiah(previewPoModal.tax)}</span>
                </div>
                {previewPoModal.taxLegalBasis && (
                  <div className="text-[10px] text-slate-400 text-right -mt-0.5">
                    Dasar Hukum: {previewPoModal.taxLegalBasis}
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-black text-slate-900">
                  <span>Grand Total:</span>
                  <span className="text-emerald-700">{formatRupiah(previewPoModal.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Status Finansial & Pembayaran Kasir */}
            <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
              previewPoModal.paymentStatus === "PAID"
                ? "bg-emerald-50/70 border-emerald-200"
                : previewPoModal.paymentStatus === "PARTIAL"
                ? "bg-amber-50/70 border-amber-200"
                : "bg-rose-50/70 border-rose-200"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-slate-700" />
                  <span className="font-bold text-slate-900">STATUS PEMBAYARAN KASIR</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  previewPoModal.paymentStatus === "PAID"
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : previewPoModal.paymentStatus === "PARTIAL"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-rose-100 text-rose-800 border-rose-300"
                }`}>
                  {previewPoModal.paymentStatus === "PAID"
                    ? "🟢 LUNAS (PAID)"
                    : previewPoModal.paymentStatus === "PARTIAL"
                    ? "🟡 UANG MUKA / DP (PARTIAL)"
                    : "🔴 BELUM LUNAS (UNPAID)"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Termin Pembayaran:</span>
                  <span className="font-semibold text-slate-800">
                    {previewPoModal.paymentTerms === "TEMPO_30"
                      ? "Tempo 30 Hari (Net 30)"
                      : previewPoModal.paymentTerms === "TEMPO_60"
                      ? "Tempo 60 Hari (Net 60)"
                      : previewPoModal.paymentTerms === "COD"
                      ? "Cash On Delivery (COD)"
                      : previewPoModal.paymentTerms === "CASH"
                      ? "Tunai Dimuka (Cash)"
                      : previewPoModal.paymentTerms === "DP_50"
                      ? "DP 50%"
                      : previewPoModal.paymentTerms || "Net 30"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Jumlah Terbayar:</span>
                  <span className="font-bold text-emerald-700">
                    {formatRupiah(previewPoModal.paidAmount || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Sisa Tagihan:</span>
                  <span className="font-bold text-rose-600">
                    {formatRupiah(Math.max(0, (previewPoModal.totalAmount || 0) - (previewPoModal.paidAmount || 0)))}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Metode Bayar:</span>
                  <span className="font-medium text-slate-700">
                    {previewPoModal.paymentMethod === "TRANSFER_BANK"
                      ? "Transfer Bank"
                      : previewPoModal.paymentMethod === "CASH"
                      ? "Tunai Kasir"
                      : previewPoModal.paymentMethod || "-"}
                  </span>
                </div>
              </div>

              {previewPoModal.paymentNotes && (
                <div className="pt-1.5 border-t border-slate-200/60 text-[11px] text-slate-600">
                  <span className="font-semibold">Catatan Kasir:</span> {previewPoModal.paymentNotes}
                </div>
              )}
            </div>

            {/* Status Penerimaan di Gudang */}
            {previewPoModal.status === "RECEIVED" ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-emerald-900">BARANG SUDAH SAMPAI DI GUDANG</span>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-200/80 text-emerald-800 px-2.5 py-0.5 rounded-full">
                    ✓ DITERIMA & STOK MASUK
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-emerald-900">
                  <div>
                    <span className="text-emerald-600 block text-[10px] uppercase font-bold">Gudang Penerima:</span>
                    <span className="font-semibold">{previewPoModal.receivedWarehouse || "Gudang Utama Jakarta"}</span>
                  </div>
                  <div>
                    <span className="text-emerald-600 block text-[10px] uppercase font-bold">Petugas Penerima:</span>
                    <span className="font-semibold">{previewPoModal.receivedBy || "Staf Gudang"}</span>
                  </div>
                  <div>
                    <span className="text-emerald-600 block text-[10px] uppercase font-bold">Waktu Barang Tiba:</span>
                    <span>{formatDate(previewPoModal.receivedAt)}</span>
                  </div>
                  <div>
                    <span className="text-emerald-600 block text-[10px] uppercase font-bold">Catatan Gudang:</span>
                    <span className="italic">{previewPoModal.receiptNotes || "Pemeriksaan fisik lengkap"}</span>
                  </div>
                </div>
                {previewPoModal.receiptPhotoUrl && (
                  <div className="pt-2 border-t border-emerald-200">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block mb-1">
                      Foto Bukti Kedatangan Fisik dari Gudang:
                    </span>
                    <div className="relative rounded-lg overflow-hidden border border-emerald-300 max-w-xs shadow-xs">
                      <img
                        src={previewPoModal.receiptPhotoUrl}
                        alt="Bukti Kedatangan"
                        className="w-full object-cover max-h-40"
                      />
                      {previewPoModal.receiptTimestamp && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] font-mono px-2 py-0.5">
                          🕒 {previewPoModal.receiptTimestamp}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs flex items-center justify-between text-amber-900">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>Status: <b>Sedang Diproses / Menunggu Pengiriman ke Gudang</b></span>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  MENUNGGU GUDANG
                </span>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Diterbitkan secara sah oleh: <b>{previewPoModal.createdBy}</b>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSendPoWhatsApp(previewPoModal)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Kirim PO ke WhatsApp Vendor"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim via WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleOpenPaymentModal(previewPoModal);
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Catat atau Ubah Pembayaran Kasir"
                >
                  <Banknote className="w-4 h-4 text-rose-600" />
                  <span>Catat Pembayaran</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-900 hover:bg-black text-white px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak PO</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CATAT PEMBAYARAN KASIR & STATUS FINANSIAL PO */}
      {paymentModalPo && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setPaymentModalPo(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3 flex items-start gap-3">
              <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Catat Pembayaran Kasir (Finansial)</h3>
                <p className="text-xs text-slate-500">
                  Update status pembayaran untuk PO <span className="font-mono font-bold text-slate-700">{paymentModalPo.poNumber}</span>
                </p>
              </div>
            </div>

            {/* Ringkasan PO */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Vendor / Pemasok:</span>
                <span className="font-bold text-slate-900">{paymentModalPo.supplierName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Nilai PO (Termasuk PPN):</span>
                <span className="font-black text-emerald-700 text-sm">{formatRupiah(paymentModalPo.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                <span>Sudah Dibayar Sebelumnya:</span>
                <span className="font-semibold text-slate-800">{formatRupiah(paymentModalPo.paidAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sisa Tagihan Saat Ini:</span>
                <span className="font-bold text-rose-600">
                  {formatRupiah(Math.max(0, (paymentModalPo.totalAmount || 0) - (paymentModalPo.paidAmount || 0)))}
                </span>
              </div>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-3.5 text-xs">
              {/* Pilihan Status Pembayaran */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Status Pembayaran Baru *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentForm({
                        ...paymentForm,
                        paymentStatus: "PAID",
                        paidAmount: paymentModalPo.totalAmount,
                      });
                    }}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      paymentForm.paymentStatus === "PAID"
                        ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900 font-bold"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Check className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    <span>Lunas Penuh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentForm({
                        ...paymentForm,
                        paymentStatus: "PARTIAL",
                        paidAmount: Math.round(paymentModalPo.totalAmount * 0.5),
                      });
                    }}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      paymentForm.paymentStatus === "PARTIAL"
                        ? "bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-900 font-bold"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Receipt className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                    <span>DP / Sebagian</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentForm({
                        ...paymentForm,
                        paymentStatus: "UNPAID",
                        paidAmount: 0,
                      });
                    }}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      paymentForm.paymentStatus === "UNPAID"
                        ? "bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-900 font-bold"
                        : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <Wallet className="w-4 h-4 mx-auto mb-1 text-rose-600" />
                    <span>Belum Lunas</span>
                  </button>
                </div>
              </div>

              {/* Jumlah yang Dibayar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Jumlah Terbayar (Rp) *</label>
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, paidAmount: paymentModalPo.totalAmount })}
                    className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    Set Lunas Penuh ({formatRupiah(paymentModalPo.totalAmount)})
                  </button>
                </div>
                <div className="relative">
                  <Banknote className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="number"
                    min="0"
                    max={paymentModalPo.totalAmount}
                    required
                    value={paymentForm.paidAmount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      let newStatus: "PAID" | "PARTIAL" | "UNPAID" = paymentForm.paymentStatus;
                      if (val >= paymentModalPo.totalAmount) {
                        newStatus = "PAID";
                      } else if (val > 0) {
                        newStatus = "PARTIAL";
                      } else {
                        newStatus = "UNPAID";
                      }
                      setPaymentForm({ ...paymentForm, paidAmount: val, paymentStatus: newStatus });
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>Sisa Hutang Setelah Pembayaran Ini:</span>
                  <span className="font-bold text-rose-600">
                    {formatRupiah(Math.max(0, paymentModalPo.totalAmount - (Number(paymentForm.paidAmount) || 0)))}
                  </span>
                </div>
              </div>

              {/* Metode Pembayaran & Termin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Metode Pembayaran *</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium cursor-pointer"
                  >
                    <option value="TRANSFER_BANK">Transfer Bank (BCA / Mandiri / BRI / BNI)</option>
                    <option value="CASH">Kas Kecil / Tunai (Petty Cash)</option>
                    <option value="GIRO">Giro / Cek Perusahaan</option>
                    <option value="KREDIT_PERUSAHAAN">Kartu Kredit Perusahaan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Termin Pembayaran *</label>
                  <select
                    value={paymentForm.paymentTerms}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentTerms: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium cursor-pointer"
                  >
                    <option value="TEMPO_30">Tempo 30 Hari (Net 30)</option>
                    <option value="TEMPO_60">Tempo 60 Hari (Net 60)</option>
                    <option value="TEMPO_14">Tempo 14 Hari (Net 14)</option>
                    <option value="CASH">Tunai Dimuka (Cash)</option>
                    <option value="COD">Cash on Delivery (COD)</option>
                    <option value="DP_50">Uang Muka 50% (DP 50%)</option>
                  </select>
                </div>
              </div>

              {/* Catatan / No Referensi Transfer */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Referensi Transfer / Catatan Kasir</label>
                <input
                  type="text"
                  placeholder="Contoh: No Ref BCA-892314, dibayar via rekening giro operasional"
                  value={paymentForm.paymentNotes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentNotes: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentModalPo(null)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingPayment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Simpan Status Pembayaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BUKTI PENERIMAAN / KEDATANGAN BARANG DARI GUDANG */}
      {selectedDeliveryProof && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4 animate-scaleUp">
            <button
              type="button"
              onClick={() => setSelectedDeliveryProof(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Modal Bukti Kedatangan */}
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-xs">
                <Truck className="w-6 h-6 text-emerald-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Bukti Fisik Barang Masuk Gudang
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    {selectedDeliveryProof.poNumber}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-0.5">
                  Verifikasi Kedatangan &amp; Bukti Foto Barang
                </h3>
                <p className="text-xs text-slate-500">
                  Data fisik barang yang telah diverifikasi dan dikirimkan oleh Staf Gudang ke Tim Purchasing
                </p>
              </div>
            </div>

            {/* Kartu Grid Rincian Tanggal Masuk, Jam & Menit, Gudang, Vendor */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pemasok / Vendor:</span>
                <p className="font-bold text-slate-900 text-sm">{selectedDeliveryProof.supplierName}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Lokasi Gudang Penerima:</span>
                <p className="font-bold text-slate-900 text-sm">
                  🏢 {selectedDeliveryProof.receivedWarehouse || "Gudang Utama"}
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tanggal Masuk Barang:</span>
                <p className="font-bold text-slate-900 text-xs flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{formatDate(selectedDeliveryProof.receivedAt)}</span>
                </p>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Jam &amp; Menit Masuk:</span>
                <p className="font-mono font-bold text-emerald-800 text-xs flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{formatTime(selectedDeliveryProof.receivedAt)}</span>
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Petugas Penerima Gudang:</span>
                <p className="font-semibold text-emerald-800 text-xs mt-0.5">
                  👤 {selectedDeliveryProof.receivedBy || "Staf Penerimaan Gudang"}
                </p>
              </div>
            </div>

            {/* Rincian Nama Item Barang yang Masuk */}
            {selectedDeliveryProof.items && selectedDeliveryProof.items.length > 0 && (
              <div className="border border-slate-200 rounded-xl p-3.5 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <span>Daftar Nama Item Barang Yang Diterima:</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                    {selectedDeliveryProof.items.length} Item
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedDeliveryProof.items.map((it: any, i: number) => (
                    <div key={i} className="py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="font-bold text-slate-800">{it.productName}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                        +{it.quantity} {it.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Catatan Pemeriksaan Gudang */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-0.5">
                Catatan Pemeriksaan Staf Gudang:
              </span>
              <p className="text-slate-800 font-medium italic text-[11px]">
                "{selectedDeliveryProof.receiptNotes || "Barang pesanan telah tiba lengkap, fisik utuh dan sesuai spesifikasi PO."}"
              </p>
            </div>

            {/* Foto Bukti Fisik Barang dengan Gambar, Jam dan Menit, Tanggal */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Foto Bukti Fisik Kedatangan / Surat Jalan:</span>
                </span>
                {selectedDeliveryProof.receiptTimestamp && (
                  <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">
                    Stempel: {selectedDeliveryProof.receiptTimestamp}
                  </span>
                )}
              </div>

              {selectedDeliveryProof.receiptPhotoUrl ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-900 group">
                  <img
                    src={selectedDeliveryProof.receiptPhotoUrl}
                    alt="Bukti Kedatangan Gudang"
                    className="w-full object-contain max-h-80 mx-auto"
                  />
                  {/* Overlay Watermark Tanggal, Jam dan Menit, serta Nama Item */}
                  <div className="p-3 bg-gradient-to-t from-slate-950 via-slate-900/90 to-transparent text-white space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <BadgeCheck className="w-4 h-4" />
                        <span>Terverifikasi Kedatangan Gudang</span>
                      </span>
                      <span className="text-[11px] text-slate-300 font-bold">
                        {formatDate(selectedDeliveryProof.receivedAt)} • {formatTime(selectedDeliveryProof.receivedAt)}
                      </span>
                    </div>
                    {selectedDeliveryProof.items && selectedDeliveryProof.items.length > 0 && (
                      <p className="text-[10px] text-slate-300 truncate">
                        Item: {selectedDeliveryProof.items.map((it: any) => it.productName).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-100 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                  <Package className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p>Penerimaan fisik barang telah diverifikasi secara sah oleh sistem gudang.</p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedDeliveryProof(null)}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition shadow-sm"
              >
                Tutup Bukti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: PUSAT INFORMASI & SINKRONISASI REGULASI PAJAK INDONESIA (pajak.go.id) */}
      {showTaxModal && (
        <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setShowTaxModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl shrink-0">
                <Landmark className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase">
                    Kementerian Keuangan RI • DJP
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Live Sync pajak.go.id
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  Regulasi Pajak Pertambahan Nilai (PPN) Indonesia
                </h2>
                <p className="text-xs text-slate-500">
                  Sinkronisasi tarif resmi DJP untuk penghitungan transaksi pengadaan barang &amp; jasa
                </p>
              </div>
            </div>

            {/* Status Pajak Aktif */}
            <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                    Tarif PPN Nasional Berlaku Saat Ini:
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-3xl font-black text-white">{initialData.taxSetting?.rate || 12}%</span>
                    <span className="text-xs text-emerald-200">
                      (Efektif PMK-131: {initialData.taxSetting?.effectiveRate || 11}%)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSyncingTax}
                  onClick={handleSyncTax}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingTax ? "animate-spin" : ""}`} />
                  <span>{isSyncingTax ? "Menghubungi DJP..." : "Sinkronkan Pajak"}</span>
                </button>
              </div>

              <div className="pt-2 border-t border-emerald-800/80 text-xs text-emerald-100 space-y-1">
                <p>
                  <strong>Dasar Hukum:</strong> {initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) & PMK No. 131/2024"}
                </p>
                <p className="text-[11px] text-emerald-300/90">
                  <strong>Otoritas Perpajakan:</strong> {initialData.taxSetting?.authority || "Direktorat Jenderal Pajak (DJP) - Kementerian Keuangan RI"}
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
                  <span>Terakhir Diperiksa: {formatDate(initialData.taxSetting?.lastSyncedAt || new Date())}</span>
                  <a
                    href="https://pajak.go.id"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white flex items-center gap-1"
                  >
                    <span>Portal Resmi DJP</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* 3 Skema Pajak yang Tersedia */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Skema Perhitungan Pajak pada PO:</span>
              <div className="space-y-2">
                {(initialData.taxSetting?.categories || []).map((cat: any) => (
                  <div key={cat.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{cat.name}</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono">
                          {cat.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{cat.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 italic">Dasar Hukum: {cat.legalBasis}</p>
                    </div>
                    <span className="text-base font-black text-emerald-700 shrink-0">{cat.rate}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Perubahan Tarif Pajak Indonesia */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Riwayat Penyesuaian Tarif PPN Indonesia:</span>
              </span>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase">
                    <tr>
                      <th className="p-2">Periode Berlaku</th>
                      <th className="p-2 text-center">Tarif</th>
                      <th className="p-2">Dasar Regulasi</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {(initialData.taxSetting?.history || []).map((h: any, idx: number) => (
                      <tr key={idx} className={h.status === "BERLAKU AKTIF" ? "bg-emerald-50/60 font-semibold" : ""}>
                        <td className="p-2">{h.period}</td>
                        <td className="p-2 text-center font-bold text-emerald-700">{h.rate}%</td>
                        <td className="p-2 text-[11px] text-slate-600">{h.basis}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              h.status === "BERLAKU AKTIF"
                                ? "bg-emerald-200 text-emerald-900"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Otomatis dihitung saat penerbitan Purchase Order
              </span>
              <button
                type="button"
                onClick={() => setShowTaxModal(false)}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH VENDOR BARU */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <button
              type="button"
              onClick={() => setShowVendorModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Daftarkan Vendor / Supplier Baru</h3>
              <p className="text-xs text-slate-500">Tambahkan rekanan vendor resmi ke dalam sistem pengadaan</p>
            </div>

            <form onSubmit={handleCreateVendorSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Perusahaan Vendor *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Distributor Sentosa"
                  value={newVendorForm.name}
                  onChange={(e) => setNewVendorForm({ ...newVendorForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Telepon</label>
                  <input
                    type="tel"
                    placeholder="Contoh: 021-5551234"
                    value={newVendorForm.phone}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789"
                    value={newVendorForm.whatsapp}
                    onChange={(e) => setNewVendorForm({ ...newVendorForm, whatsapp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Produk / Jasa</label>
                <input
                  type="text"
                  placeholder="Contoh: Material & Logistik, Elektronik, Bahan Kimia"
                  value={newVendorForm.category}
                  onChange={(e) => setNewVendorForm({ ...newVendorForm, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Kantor / Toko</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap atau tautan Google Maps"
                  value={newVendorForm.address}
                  onChange={(e) => setNewVendorForm({ ...newVendorForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer"
                >
                  Simpan Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: DAFTARKAN PENAWARAN HARGA BAHAN BAKU VENDOR BARU */}
      {showAddPriceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setShowAddPriceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3 flex items-start gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Daftarkan Penawaran Harga Bahan Baku</h3>
                <p className="text-xs text-slate-500">
                  Catat harga penawaran resmi dari vendor rekanan untuk komparasi dan acuan penerbitan PO
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveVendorPrice} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Bahan Baku / Material *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Biji Plastik HDPE Virgin, Kabel Tembaga NYY 4x16mm, Pelat Baja..."
                  value={newPriceForm.productName}
                  onChange={(e) => setNewPriceForm({ ...newPriceForm, productName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kategori Bahan Baku *</label>
                  <select
                    value={newPriceForm.category}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, category: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Bahan Baku Plastik">Bahan Baku Plastik</option>
                    <option value="Logam & Manufaktur">Logam &amp; Manufaktur</option>
                    <option value="Komponen & Listrik">Komponen &amp; Listrik</option>
                    <option value="Bahan Kimia & Pelarut">Bahan Kimia &amp; Pelarut</option>
                    <option value="Kemasan & Packaging">Kemasan &amp; Packaging</option>
                    <option value="Bahan Baku Pangan">Bahan Baku Pangan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Vendor Penyedia *</label>
                  <input
                    type="text"
                    required
                    list="vendors-quote-datalist"
                    placeholder="Contoh: PT Chandra Asri, Toko Glodok..."
                    value={newPriceForm.vendorName}
                    onChange={(e) => {
                      const vName = e.target.value;
                      const matched = allKnownSuppliers.find((s: any) => s.name.toLowerCase() === vName.toLowerCase());
                      if (matched) {
                        setNewPriceForm({
                          ...newPriceForm,
                          vendorName: vName,
                          vendorPhone: matched.phone || newPriceForm.vendorPhone,
                          vendorWhatsapp: matched.whatsapp || matched.phone || newPriceForm.vendorWhatsapp,
                          vendorAddress: matched.address || newPriceForm.vendorAddress,
                        });
                      } else {
                        setNewPriceForm({ ...newPriceForm, vendorName: vName });
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white"
                  />
                  <datalist id="vendors-quote-datalist">
                    {allKnownSuppliers.map((s: any) => (
                      <option key={s.id || s.name} value={s.name}>
                        {s.phone ? `HP: ${s.phone}` : ""}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor WhatsApp Sales / Toko</label>
                  <input
                    type="tel"
                    placeholder="08123456789 (Untuk direct chat WA)"
                    value={newPriceForm.vendorWhatsapp}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, vendorWhatsapp: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nomor Telepon Kantor</label>
                  <input
                    type="tel"
                    placeholder="021-5551234"
                    value={newPriceForm.vendorPhone}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, vendorPhone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Satuan Barang *</label>
                  <input
                    type="text"
                    required
                    placeholder="ton, kg, meter, drum, pcs..."
                    value={newPriceForm.unit}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, unit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Harga Satuan Penawaran (Rp) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="Contoh: 26500000"
                    value={newPriceForm.unitPrice || ""}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, unitPrice: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500"
                  />
                  {newPriceForm.unitPrice > 0 && (
                    <span className="text-[10px] text-emerald-700 font-bold mt-0.5 block">
                      = {formatRupiah(newPriceForm.unitPrice)} / {newPriceForm.unit || "unit"}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Minimal Order (MOQ)</label>
                  <input
                    type="number"
                    min="1"
                    value={newPriceForm.minOrderQty}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, minOrderQty: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Waktu Kirim (Lead Time)</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Hari"
                    value={newPriceForm.leadTimeDays}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, leadTimeDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Termin Pembayaran</label>
                  <select
                    value={newPriceForm.paymentTerms}
                    onChange={(e) => setNewPriceForm({ ...newPriceForm, paymentTerms: e.target.value })}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="TEMPO_30">Tempo 30 Hari</option>
                    <option value="TEMPO_60">Tempo 60 Hari</option>
                    <option value="TEMPO_14">Tempo 14 Hari</option>
                    <option value="COD">COD</option>
                    <option value="CASH">Tunai Dimuka</option>
                    <option value="DP_50">DP 50%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Spesifikasi / Grade Bahan Baku</label>
                <input
                  type="text"
                  placeholder="Contoh: Virgin Injection Moulding, JIS G3101 SS400, Food Grade FDA..."
                  value={newPriceForm.grade}
                  onChange={(e) => setNewPriceForm({ ...newPriceForm, grade: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alamat Pabrik / Gudang Vendor</label>
                <input
                  type="text"
                  placeholder="Alamat pabrik atau lokasi pengambilan barang"
                  value={newPriceForm.vendorAddress}
                  onChange={(e) => setNewPriceForm({ ...newPriceForm, vendorAddress: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tambahan Penawaran</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan kemasan (pallet/zak), nomor sertifikat COA, batas validitas harga, dll."
                  value={newPriceForm.notes}
                  onChange={(e) => setNewPriceForm({ ...newPriceForm, notes: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPriceModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPrice}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingPrice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Simpan Penawaran Harga</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: UBAH & SINKRONKAN HARGA RESMI DARI VENDOR */}
      {editSyncPriceItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setEditSyncPriceItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3 flex items-start gap-3">
              <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Ubah &amp; Sinkronkan Harga Vendor</h3>
                <p className="text-xs text-slate-500">
                  Update harga penawaran saat vendor mengubah harga agar data di sistem purchasing selalu sinkron
                </p>
              </div>
            </div>

            {/* Info Bahan Baku & Vendor */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Nama Bahan Baku:</span>
                <span className="font-bold text-slate-900">{editSyncPriceItem.productName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Vendor / Pemasok:</span>
                <span className="font-bold text-slate-900">{editSyncPriceItem.vendorName}</span>
              </div>
              <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-1.5">
                <span>Harga Terdaftar Saat Ini:</span>
                <span className="font-black text-slate-800 text-sm">
                  {formatRupiah(editSyncPriceItem.unitPrice)} / {editSyncPriceItem.unit}
                </span>
              </div>
              {editSyncPriceItem.previousPrice && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Harga Sebelum Terakhir:</span>
                  <span>{formatRupiah(editSyncPriceItem.previousPrice)} / {editSyncPriceItem.unit}</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveSyncPrice} className="space-y-4 text-xs">
              {/* Input Harga Baru */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Harga Satuan Baru dari Vendor (Rp) *
                </label>
                <div className="relative">
                  <Banknote className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="number"
                    min="1"
                    required
                    value={editPriceForm.newPrice}
                    onChange={(e) => setEditPriceForm({ ...editPriceForm, newPrice: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm font-black text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Kalkulasi Selisih Fluktuasi */}
                {Number(editPriceForm.newPrice) > 0 && Number(editPriceForm.newPrice) !== editSyncPriceItem.unitPrice && (
                  <div className="mt-2 p-2.5 rounded-lg border text-[11px] flex items-center justify-between font-bold animate-fadeIn">
                    {Number(editPriceForm.newPrice) > editSyncPriceItem.unitPrice ? (
                      <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border-rose-200 p-1 rounded-md w-full">
                        <TrendingUp className="w-4 h-4 text-rose-600" />
                        <span>
                          Kenaikan Harga: +{formatRupiah(Number(editPriceForm.newPrice) - editSyncPriceItem.unitPrice)} (+{(((Number(editPriceForm.newPrice) - editSyncPriceItem.unitPrice) / editSyncPriceItem.unitPrice) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border-emerald-200 p-1 rounded-md w-full">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>
                          Penurunan Harga (Lebih Hemat): -{formatRupiah(editSyncPriceItem.unitPrice - Number(editPriceForm.newPrice))} (-{(((editSyncPriceItem.unitPrice - Number(editPriceForm.newPrice)) / editSyncPriceItem.unitPrice) * 100).toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Alasan / Catatan Perubahan Harga */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan / Keterangan Perubahan Harga dari Vendor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Kenaikan harga minyak dunia, fluktuasi kurs USD, diskon volume, dll."
                  value={editPriceForm.reason}
                  onChange={(e) => setEditPriceForm({ ...editPriceForm, reason: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500"
                />

                {/* Quick Chips Alasan */}
                <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-slate-500">
                  <span className="text-[10px] text-slate-400">Pilih Cepat:</span>
                  {[
                    "Fluktuasi Kurs Mata Uang (USD)",
                    "Kenaikan Harga Bahan Baku Global",
                    "Penyesuaian Biaya Logistik & BBM",
                    "Pricelist Resmi Kuartal Baru",
                    "Diskon Khusus Volume Pembelian",
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditPriceForm({ ...editPriceForm, reason: r })}
                      className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 px-2 py-0.5 rounded text-[10px] transition cursor-pointer border border-slate-200"
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">⚡ Dampak Sinkronisasi:</p>
                <p>• Data di Katalog Harga Bahan Baku akan langsung terupdate ke harga baru.</p>
                <p>• Rekalkulasi penanda <b>Best Price</b> akan otomatis diperbarui antar seluruh vendor.</p>
                <p>• Penerbitan PO baru ke depan akan otomatis menggunakan harga terupdate ini.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditSyncPriceItem(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSyncPrice}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingSyncPrice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  <span>Simpan &amp; Sinkronkan Harga</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 9: RIWAYAT FLUKTUASI & PERUBAHAN HARGA VENDOR */}
      {showPriceHistoryItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setShowPriceHistoryItem(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-100 pb-3 flex items-start gap-3">
              <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Riwayat Fluktuasi Harga Vendor</h3>
                <p className="text-xs text-slate-500">
                  Tracking histori perubahan harga untuk <b>{showPriceHistoryItem.productName}</b> dari <b>{showPriceHistoryItem.vendorName}</b>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(() => {
                let list: any[] = [];
                try {
                  list = JSON.parse(showPriceHistoryItem.priceHistoryJson || "[]");
                } catch {}

                if (list.length === 0) {
                  return (
                    <div className="p-6 text-center text-slate-400 text-xs">
                      Belum ada catatan riwayat perubahan harga untuk penawaran ini.
                    </div>
                  );
                }

                return list.map((h: any, idx: number) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        {formatRupiah(h.oldPrice)} ➔ <span className="text-emerald-700">{formatRupiah(h.newPrice)}</span>
                      </span>
                      {h.percentDiff > 0 ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                          ↗️ +{h.percentDiff}%
                        </span>
                      ) : h.percentDiff < 0 ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          ↘️ {h.percentDiff}% (Hemat)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                          Stabil
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px]">
                      <b>Alasan:</b> {h.reason || "Perubahan harga vendor"}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200/60 pt-1">
                      <span>Waktu: {formatDate(h.changedAt)}</span>
                      <span>Oleh: {h.changedBy || "Staf Purchasing"}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPriceHistoryItem(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: INTEGRASI TELEGRAM ID CARD & BOT NOTIFIKASI */}
      {showTelegramModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-5 animate-scaleUp">
            <button
              type="button"
              onClick={() => setShowTelegramModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header Modal */}
            <div className="flex items-start gap-3.5 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Telegram Integration
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">Real-time Alert</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  Koneksi Notifikasi Telegram ID Card
                </h3>
                <p className="text-xs text-slate-500">
                  Hubungkan nomor ID Card staf Purchasing ke akun Telegram untuk menerima alert otomatis penerbitan PO, status kedatangan barang gudang, dan pembayaran kasir.
                </p>
              </div>
            </div>

            {/* Navigation Tab Modal */}
            <div className="flex border-b border-slate-200">
              <button
                type="button"
                onClick={() => setTelegramTab("staff")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition ${
                  telegramTab === "staff"
                    ? "border-sky-600 text-sky-700 bg-sky-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>ID Card Saya ({currentStaff?.idCard || "Staff"})</span>
              </button>
              <button
                type="button"
                onClick={() => setTelegramTab("bot")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 cursor-pointer transition ${
                  telegramTab === "bot"
                    ? "border-sky-600 text-sky-700 bg-sky-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Pengaturan Bot Perusahaan</span>
              </button>
            </div>

            {/* TAB 1: Hubungkan Telegram ke ID Card Karyawan */}
            {telegramTab === "staff" && (
              <div className="space-y-4">
                {currentStaff ? (
                  <div className="p-3.5 bg-sky-50/60 border border-sky-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
                        {currentStaff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{currentStaff.name}</p>
                        <p className="text-[11px] text-slate-500">{currentStaff.position}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">ID Card</span>
                      <span className="font-mono font-bold bg-white border border-sky-200 text-sky-800 px-2 py-0.5 rounded text-xs">
                        {currentStaff.idCard}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                    Silakan login terlebih dahulu dengan nomor ID Card Anda untuk menghubungkan akun Telegram.
                  </div>
                )}

                {/* Form Input Staf Telegram */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Telegram Chat ID Pribadi <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={telegramChatIdInput}
                        onChange={(e) => setTelegramChatIdInput(e.target.value)}
                        placeholder="Contoh: 123456789"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Chat ID adalah nomor identitas unik akun Telegram Anda (bukan nomor telepon).
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Username Telegram (Opsional)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-xs">@</span>
                      <input
                        type="text"
                        value={telegramUsernameInput}
                        onChange={(e) => setTelegramUsernameInput(e.target.value)}
                        placeholder="username_anda"
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={telegramEnabledInput}
                        onChange={(e) => setTelegramEnabledInput(e.target.checked)}
                        className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Aktifkan Notifikasi Telegram Real-Time untuk ID Card ini
                      </span>
                    </label>
                  </div>
                </div>

                {/* Panduan Cara Mendapatkan Chat ID */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <Sparkles className="w-4 h-4 text-sky-500" />
                    <span>Cara Cepat Mengetahui Telegram Chat ID Anda:</span>
                  </div>
                  <ol className="list-decimal list-inside text-slate-600 space-y-1 text-[11px] pl-1">
                    <li>Buka aplikasi Telegram di HP atau Komputer Anda.</li>
                    <li>
                      Cari bot info gratis: ketik <b>@userinfobot</b> pada kolom pencarian Telegram.
                    </li>
                    <li>
                      Kirim pesan atau klik tombol <b>/start</b> pada bot tersebut.
                    </li>
                    <li>
                      Bot akan membalas dengan menampilkan <b>Id: (nomor Chat ID Anda)</b>.
                    </li>
                    <li>Salin nomor tersebut lalu tempel pada kolom Chat ID di atas.</li>
                  </ol>
                </div>

                {/* Feedback Uji Coba */}
                {telegramTestFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs font-medium border ${
                      telegramTestFeedback.success
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-rose-50 text-rose-800 border-rose-200"
                    }`}
                  >
                    {telegramTestFeedback.msg}
                  </div>
                )}

                {/* Tombol Aksi */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleTestStaffTelegram}
                    disabled={isTestingTelegram || !currentStaff}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-sky-600" />
                    <span>{isTestingTelegram ? "Mengirim..." : "Kirim Pesan Uji Coba"}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTelegramModal(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveStaffTelegram}
                      disabled={isSavingTelegram || !currentStaff}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSavingTelegram ? "Menyimpan..." : "Simpan Pengaturan ID Card"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Konfigurasi Bot Telegram Perusahaan */}
            {telegramTab === "bot" && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">🤖 Konfigurasi Bot Telegram Resmi Perusahaan</p>
                  <p className="text-[11px]">
                    Bot Token digunakan oleh server sistem untuk mengirimkan notifikasi resmi ke akun Telegram staf. Anda bisa membuat bot Telegram baru secara gratis melalui <b>@BotFather</b> di Telegram.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Telegram Bot Token (dari @BotFather)
                    </label>
                    <input
                      type="password"
                      value={botTokenInput}
                      onChange={(e) => setBotTokenInput(e.target.value)}
                      placeholder="Contoh: 7123456789:AAHxxxxx_xxxxxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Token tersimpan aman di database dan juga mendukung fallback otomatis ke environment variable <code>TELEGRAM_BOT_TOKEN</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Username Bot Telegram
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-400 text-xs">@</span>
                      <input
                        type="text"
                        value={botUsernameInput}
                        onChange={(e) => setBotUsernameInput(e.target.value)}
                        placeholder="Contoh: PengadaanPurchasingBot"
                        className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-2 focus:ring-sky-500 outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={botActiveInput}
                        onChange={(e) => setBotActiveInput(e.target.checked)}
                        className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                      />
                      <span className="text-xs font-semibold text-slate-800">
                        Aktifkan Layanan Notifikasi Bot Telegram Perusahaan
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowTelegramModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBotConfig}
                    disabled={isSavingBotConfig}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSavingBotConfig ? "Menyimpan..." : "Simpan Konfigurasi Bot"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL INTEGRASI 9ROUTER AI GATEWAY */}
      <NineRouterModal
        isOpen={showNineRouterModal}
        onClose={() => setShowNineRouterModal(false)}
        projectLabel="Purchasing"
        localPort={3001}
        initialConfig={initialData?.nineRouterConfig}
        onStatusUpdated={setNineRouterStatus}
        onSaveConfigAction={saveNineRouterConfig}
        onTestConnectionAction={testNineRouterConnection}
        onToast={showMessage}
      />

      {/* CHATBOT AI TERHUBUNG KE 9ROUTER (POJOK KANAN BAWAH) */}
      {dashboardPrefs.showChatbot && (
        <NineRouterChatbot
          projectLabel="Purchasing"
          isConnected={nineRouterStatus.connected}
          defaultModel={initialData?.nineRouterConfig?.defaultModel}
          userIdCard={currentStaff?.idCard}
          userName={currentStaff?.name}
          userRole={currentStaff?.role}
          contextSummary={chatbotContextSummary}
          currentPrefs={{
            bgPreset: dashboardPrefs.bgPreset,
            themeColor: dashboardPrefs.themeColor,
          }}
          quickPrompts={[
            "Vendor mana saja yang menawarkan harga bahan baku termurah?",
            "PO mana saja yang status pembayarannya belum lunas?",
            "Ganti background dashboard menjadi gelap untuk akun saya",
          ]}
          onOpenSettings={() => setShowNineRouterModal(true)}
          onApplyDashboardAction={handleChatbotDashboardAction}
        />
      )}

      {/* MODAL PERSONALISASI & RESTORE DEFAULT DASHBOARD PER STAF */}
      {showCustomizerModal && currentStaff && (
        <DashboardCustomizerModal
          userName={currentStaff.name}
          userIdCard={currentStaff.idCard}
          currentPrefs={dashboardPrefs}
          onClose={() => setShowCustomizerModal(false)}
          onSave={handleSaveDashboardPrefs}
          onResetDefault={handleResetDashboardPrefs}
        />
      )}
    </div>
  );
}
