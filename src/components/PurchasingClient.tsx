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
} from "@/app/actions";
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
} from "lucide-react";
import LocationMapEmbed from "./LocationMapEmbed";

export interface CurrentStaff {
  id: string;
  idCard: string;
  name: string;
  position: string;
  role: string;
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

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<"dashboard" | "orders" | "requisitions" | "vendors" | "gudangCatalog">("dashboard");

  // Modals
  const [showCreatePoModal, setShowCreatePoModal] = useState<boolean>(false);
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false);
  const [previewPoModal, setPreviewPoModal] = useState<any | null>(null);
  const [selectedDeliveryProof, setSelectedDeliveryProof] = useState<any | null>(null);
  // Filter & Search State untuk Purchase Orders (PO)
  const [poSearchQuery, setPoSearchQuery] = useState<string>("");
  const [poStatusFilter, setPoStatusFilter] = useState<"ALL" | "WAITING" | "RECEIVED">("ALL");
  const [poVendorFilter, setPoVendorFilter] = useState<string>("ALL");
  const [poSortBy, setPoSortBy] = useState<"NEWEST" | "OLDEST" | "AMOUNT_DESC" | "AMOUNT_ASC">("NEWEST");
  const [showTaxModal, setShowTaxModal] = useState<boolean>(false);
  const [isSyncingTax, setIsSyncingTax] = useState<boolean>(false);
  const [isSubmittingPo, setIsSubmittingPo] = useState<boolean>(false);

  // Form State Buat PO Baru
  const [newPoForm, setNewPoForm] = useState({
    supplierName: "",
    supplierPhone: "",
    supplierWhatsapp: "",
    supplierAddress: "",
    expectedDeliveryDate: "",
    notes: "",
    productId: "",
    productName: "",
    quantity: 10,
    unit: "pcs",
    unitPrice: 100000,
    taxRate: initialData.taxSetting?.rate || 12,
    taxCategory: "STANDAR_12",
    taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
  });

  // Auto-Detect State untuk Perusahaan / Retail & Produk
  const [supplierMatch, setSupplierMatch] = useState<any | null>(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState<any[]>([]);
  const [productMatch, setProductMatch] = useState<any | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);

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
    poSearchQuery.trim() !== "" || poStatusFilter !== "ALL" || poVendorFilter !== "ALL" || poSortBy !== "NEWEST"
  );

  const handleResetPoFilters = () => {
    setPoSearchQuery("");
    setPoStatusFilter("ALL");
    setPoVendorFilter("ALL");
    setPoSortBy("NEWEST");
  };

  // Filtered & Sorted Purchase Orders
  const filteredPurchaseOrders = useMemo(() => {
    let list = [...(initialData.purchaseOrders || [])];

    // Filter Status Kedatangan
    if (poStatusFilter === "WAITING") {
      list = list.filter((po: any) => po.status !== "RECEIVED");
    } else if (poStatusFilter === "RECEIVED") {
      list = list.filter((po: any) => po.status === "RECEIVED");
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
  }, [initialData.purchaseOrders, poStatusFilter, poVendorFilter, poSearchQuery, poSortBy]);

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

  // Handler Auto-Detect saat Ketik Nama Barang yang Dipesan
  const handleProductNameChangeInNewPo = (val: string) => {
    const trimmed = val.trim().toLowerCase();
    const products = initialData?.gudangIntegration?.products || [];
    const matched = products.find(
      (p: any) => p.name.trim().toLowerCase() === trimmed
    );

    if (matched && trimmed.length > 0) {
      setNewPoForm((prev) => ({
        ...prev,
        productId: matched.id,
        productName: val,
        unit: matched.unit || prev.unit || "pcs",
        supplierName: prev.supplierName || matched.supplier?.name || "",
        supplierPhone: prev.supplierPhone || matched.supplier?.phone || "",
        supplierWhatsapp: prev.supplierWhatsapp || matched.supplier?.whatsapp || "",
        supplierAddress: prev.supplierAddress || matched.supplier?.address || "",
      }));
      setProductMatch(matched);
      setProductSuggestions([]);
      showMessage(
        "success",
        `✓ Barang "${matched.name}" terdeteksi di katalog gudang (Satuan: ${matched.unit})`
      );
    } else {
      setNewPoForm((prev) => ({
        ...prev,
        productName: val,
      }));
      setProductMatch(null);

      if (trimmed.length >= 2) {
        const partials = products.filter(
          (p: any) =>
            p.name.toLowerCase().includes(trimmed) &&
            p.name.toLowerCase() !== trimmed
        );
        setProductSuggestions(partials.slice(0, 3));
      } else {
        setProductSuggestions([]);
      }
    }
  };

  const applyProductToNewPo = (p: any) => {
    setNewPoForm((prev) => ({
      ...prev,
      productId: p.id,
      productName: p.name,
      unit: p.unit || "pcs",
      supplierName: prev.supplierName || p.supplier?.name || "",
      supplierPhone: prev.supplierPhone || p.supplier?.phone || "",
      supplierWhatsapp: prev.supplierWhatsapp || p.supplier?.whatsapp || "",
      supplierAddress: prev.supplierAddress || p.supplier?.address || "",
    }));
    setProductMatch(p);
    setProductSuggestions([]);
    showMessage("success", `✓ Barang "${p.name}" dipilih dari katalog gudang.`);
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
          setCurrentStaff(parsed);
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
      };
      setCurrentStaff(loggedStaff);
      localStorage.setItem("purchasing_logged_in_staff", JSON.stringify(loggedStaff));
      setLoginIdInput("");
      showMessage("success", `Selamat datang, ${loggedStaff.name}! Login berhasil dengan ID: ${loggedStaff.idCard}`);
    } catch (err: any) {
      setLoginError(err.message || "Gagal memverifikasi login.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handler Logout
  const handleLogout = () => {
    setCurrentStaff(null);
    setShowStaffDropdown(false);
    localStorage.removeItem("purchasing_logged_in_staff");
    showMessage("success", "Anda telah berhasil Log Out dari Sistem Purchasing.");
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
      productId: item.productId,
      productName: item.productName,
      quantity: item.recommendedReorderQty || 10,
      unit: item.unit,
      unitPrice: 50000,
      taxRate: initialData.taxSetting?.rate || 12,
      taxCategory: "STANDAR_12",
      taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
    });
    setSupplierMatch(item.preferredSupplier || null);
    setProductMatch(item);
    setShowCreatePoModal(true);
  };

  // Quick Action: Ubah PR dari Gudang menjadi PO
  const handleConvertPRToPO = (pr: any) => {
    const firstItem = (pr.items || [])[0];
    setNewPoForm({
      supplierName: "",
      supplierPhone: "",
      supplierWhatsapp: "",
      supplierAddress: "",
      expectedDeliveryDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
      notes: `Realisasi Purchase Requisition No: ${pr.prNumber} diajukan oleh ${pr.requestedBy}`,
      productId: firstItem?.productId || "",
      productName: firstItem?.productName || "",
      quantity: firstItem?.requestedQty || 10,
      unit: firstItem?.unit || "pcs",
      unitPrice: 50000,
      taxRate: initialData.taxSetting?.rate || 12,
      taxCategory: "STANDAR_12",
      taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
    });
    setSupplierMatch(null);
    setProductMatch(null);
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

  // Submit Buat PO
  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoForm.supplierName || !newPoForm.productName || !newPoForm.quantity) {
      showMessage("error", "Lengkapi vendor, produk, dan jumlah pesanan.");
      return;
    }

    setIsSubmittingPo(true);
    try {
      const created = await createPurchaseOrder({
        supplierName: newPoForm.supplierName,
        supplierPhone: newPoForm.supplierPhone || undefined,
        supplierWhatsapp: newPoForm.supplierWhatsapp || undefined,
        supplierAddress: newPoForm.supplierAddress || undefined,
        expectedDeliveryDate: newPoForm.expectedDeliveryDate || undefined,
        notes: newPoForm.notes,
        createdBy: currentStaff?.name || "Tim Purchasing",
        taxRate: Number(newPoForm.taxRate),
        taxLegalBasis: newPoForm.taxLegalBasis,
        items: [
          {
            productId: newPoForm.productId,
            productName: newPoForm.productName,
            quantity: Number(newPoForm.quantity),
            unit: newPoForm.unit,
            unitPrice: Number(newPoForm.unitPrice),
          },
        ],
      });

      setShowCreatePoModal(false);
      showMessage("success", `✓ PO ${created.poNumber} berhasil diterbitkan (PPN ${created.taxRate || newPoForm.taxRate}% - ${newPoForm.taxLegalBasis}) dan tersinkronisasi ke Gudang!`);
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
    <div className="min-h-screen bg-slate-50 text-slate-800">
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
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 text-white p-2 rounded-xl shadow-md flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-slate-900 tracking-tight">PURCHASING</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Procurement Module
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Sistem Pengadaan, Vendor & Purchase Order</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Status Koneksi ke Gudang */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                initialData.gudangIntegration.connected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                  : "bg-rose-50 text-rose-700 border-rose-300"
              }`}
              title={`Koneksi ke sistem gudang di ${initialData.gudangIntegration.apiUrl}`}
            >
              <span className="relative flex h-2 w-2">
                {initialData.gudangIntegration.connected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    initialData.gudangIntegration.connected ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                ></span>
              </span>
              <span className="hidden md:inline">Gudang:</span>
              <span>{initialData.gudangIntegration.connected ? "Terhubung (Port 3000)" : "Offline"}</span>
            </div>

            {/* Pill Sinkronisasi PPN Resmi Indonesia */}
            <button
              type="button"
              onClick={() => setShowTaxModal(true)}
              className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-xs"
              title="Lihat Regulasi Pajak Resmi Republik Indonesia (DJP / Kemenkeu)"
            >
              <Landmark className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="hidden md:inline">PPN RI:</span>
              <span className="font-bold">{initialData.taxSetting?.rate || 12}%</span>
              <span className="text-[10px] bg-emerald-200 text-emerald-900 font-mono px-1.5 py-0.5 rounded font-bold">
                pajak.go.id
              </span>
            </button>

            {/* User Profile Pill & Dropdown */}
            {currentStaff && (
              <div className="relative" ref={staffDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 pl-2 pr-3 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {currentStaff.name.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <span className="block text-xs font-bold text-slate-800 leading-tight">
                      {currentStaff.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono font-medium">
                      ID: {currentStaff.idCard}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
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
                    </div>

                    <div className="px-2 pt-1.5">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Banner Hero */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-5 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Sistem Pengadaan & Purchase Order</h1>
              <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-md uppercase">
                Enterprise Sync
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Terhubung langsung dengan Gudang Inventaris • Data barang menipis terdeteksi otomatis • Sinkronisasi PO instan
            </p>
          </div>

          <div className="flex items-center gap-2">
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
                  productId: initialData?.gudangIntegration?.products?.[0]?.id || "",
                  productName: initialData?.gudangIntegration?.products?.[0]?.name || "",
                  quantity: 10,
                  unit: initialData?.gudangIntegration?.products?.[0]?.unit || "pcs",
                  unitPrice: 100000,
                  taxRate: initialData.taxSetting?.rate || 12,
                  taxCategory: "STANDAR_12",
                  taxLegalBasis: initialData.taxSetting?.legalBasis || "UU No. 7 Tahun 2021 (UU HPP) Pasal 7 (1b)",
                });
                setSupplierMatch(null);
                setProductMatch(null);
                setSupplierSuggestions([]);
                setProductSuggestions([]);
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

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Belanja Pengadaan</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-lg sm:text-xl font-black text-slate-900 mt-2 truncate">
              {formatRupiah(initialData.stats.totalSpending)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Akumulasi seluruh PO resmi</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>PO Aktif (Terkirim ke Gudang)</span>
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              {initialData.stats.approvedCount} <span className="text-xs font-normal text-slate-500">pesanan</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Menunggu kedatangan fisik</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>PO Selesai Diterima Gudang</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-2">
              {initialData.stats.receivedCount} <span className="text-xs font-normal text-slate-500">selesai</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Stok fisik telah masuk</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Barang Gudang Menipis</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className={`text-xl sm:text-2xl font-black mt-2 ${initialData.stats.lowStockGudangCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
              {initialData.stats.lowStockGudangCount} <span className="text-xs font-normal text-slate-500">produk</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Perlu dibuatkan PO restock</div>
          </div>
        </div>

        {/* NOTIFIKASI REAL-TIME KEDATANGAN BARANG DARI GUDANG */}
        {initialData.deliveryNotifications && initialData.deliveryNotifications.length > 0 && (
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "dashboard" ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Dashboard & Pengadaan Cepat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "orders" ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Purchase Orders (PO)</span>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {initialData.stats.totalPOs}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("requisitions")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "requisitions" ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Permintaan dari Gudang (PR)</span>
            {initialData.stats.pendingPRsGudangCount > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                {initialData.stats.pendingPRsGudangCount} Permintaan
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("vendors")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "vendors" ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Direktori Vendor & Supplier</span>
            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {initialData.stats.totalVendors}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gudangCatalog")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeTab === "gudangCatalog" ? "bg-emerald-50 text-emerald-800 font-bold" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Katalog Stok Gudang (Sync)</span>
          </button>
        </div>

        {/* TAB 1: DASHBOARD & PENGADAAN CEPAT */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
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
                      Semua Status ({initialData.purchaseOrders.length})
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
                    <div key={po.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg font-mono font-bold text-xs">
                          {po.poNumber}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{po.supplierName}</p>
                          <p className="text-[10px] text-slate-500">
                            {po.items.length} Barang • Diterbitkan {formatDate(po.createdAt)} oleh {po.createdBy}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-3">
                        <div>
                          <p className="text-xs font-black text-slate-900">{formatRupiah(po.totalAmount)}</p>
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              po.status === "RECEIVED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {po.status === "RECEIVED" ? "✓ Diterima Gudang" : "⏳ Menunggu Gudang"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewPoModal(po)}
                          className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs cursor-pointer"
                          title="Lihat / Cetak PO"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PURCHASE ORDERS (PO) TABLE */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Daftar Purchase Orders (PO)</h3>
                <p className="text-xs text-slate-500">Kelola seluruh pesanan pembelian resmi kepada vendor dan lacak kedatangan barang di gudang</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreatePoModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Terbitkan PO Baru</span>
              </button>
            </div>

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
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">No. PO & Tanggal</th>
                    <th className="p-3">Vendor / Pemasok</th>
                    <th className="p-3">Daftar Barang</th>
                    <th className="p-3 text-right">Total Tagihan</th>
                    <th className="p-3 text-center">Status Kedatangan Gudang</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 px-4">
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
                        <span className="text-[10px] text-slate-400">{formatDate(po.createdAt)}</span>
                      </td>
                      <td className="p-3 font-medium">
                        <span className="font-bold text-slate-900 block">{po.supplierName}</span>
                        {po.supplierPhone && <span className="text-[10px] text-slate-500">📞 {po.supplierPhone}</span>}
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {po.items.map((it: any, i: number) => (
                            <div key={i} className="text-[11px] text-slate-700">
                              • <b>{it.productName}</b>: {it.quantity} {it.unit}
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
                      <td className="p-3 text-center">
                        {po.status === "RECEIVED" ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Sudah Sampai di Gudang</span>
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
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewPoModal(po)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 transition"
                            title="Lihat Surat Purchase Order"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Lihat PO</span>
                          </button>
                          {po.status === "RECEIVED" && (
                            <button
                              type="button"
                              onClick={() => setSelectedDeliveryProof(po)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1 shadow-xs transition"
                              title="Lihat Bukti Foto & Waktu Kedatangan dari Gudang"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Bukti Kedatangan</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PERMINTAAN DARI GUDANG (PR) */}
        {activeTab === "requisitions" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Permintaan Pengadaan Barang dari Gudang (PR)</h3>
              <p className="text-xs text-slate-500">
                Pengajuan barang restock otomatis yang diajukan oleh staf gudang saat stok fisik menipis
              </p>
            </div>

            <div className="space-y-3">
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
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
          </div>
        )}

        {/* TAB 4: DIREKTORI VENDOR / SUPPLIER */}
        {activeTab === "vendors" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Direktori Vendor & Rekanan Supplier</h3>
                <p className="text-xs text-slate-500">Daftar pemasok resmi, kontak WhatsApp dan alamat pengiriman</p>
              </div>
              <button
                type="button"
                onClick={() => setShowVendorModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
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

        {/* TAB 5: KATALOG PRODUK GUDANG (SYNC) */}
        {activeTab === "gudangCatalog" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Katalog Stok Fisik Gudang (Sinkron Real-time)</h3>
              <p className="text-xs text-slate-500">
                Data master barang dan ketersediaan stok fisik yang ditarik langsung dari sistem Gudang
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Nama Produk & Barcode</th>
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
      </main>

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

              {/* BAGIAN 2: RINCIAN BARANG YANG DIPESAN */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>Rincian Barang yang Dipesan</span>
                  </div>
                  <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                    Katalog Gudang &amp; Input Bebas
                  </span>
                </div>

                {/* Kolom Nama Barang */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kolom Nama Barang yang Dipesan *
                  </label>
                  <div className="relative">
                    <Package className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      required
                      list="gudang-products-datalist"
                      placeholder="Ketik atau pilih nama barang (contoh: Laptop ThinkPad T14, Biji Plastik HDPE...)"
                      value={newPoForm.productName}
                      onChange={(e) => handleProductNameChangeInNewPo(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                    />
                    <datalist id="gudang-products-datalist">
                      {initialData.gudangIntegration.products.map((p: any) => (
                        <option key={p.id} value={p.name}>
                          Satuan: {p.unit} • Total Stok: {p.totalStock}
                        </option>
                      ))}
                    </datalist>
                  </div>

                  {/* Indikator Jika Barang Terhubung dengan Katalog Gudang */}
                  {productMatch && (
                    <div className="mt-1.5 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-emerald-800 text-[11px] animate-fadeIn">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Terhubung dengan Katalog Gudang:</strong> Total Stok: {productMatch.totalStock} {productMatch.unit} (Min: {productMatch.minStock})
                        </span>
                      </div>
                      <span className="bg-emerald-200/70 text-emerald-900 font-bold px-2 py-0.5 rounded text-[10px]">
                        Satuan: {productMatch.unit}
                      </span>
                    </div>
                  )}

                  {/* Rekomendasi Barang jika sebagian nama cocok */}
                  {productSuggestions.length > 0 && (
                    <div className="mt-1.5 p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        Barang dari katalog gudang yang cocok:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {productSuggestions.map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => applyProductToNewPo(p)}
                            className="text-[11px] bg-white border border-emerald-300 hover:bg-emerald-600 hover:text-white text-emerald-700 px-2.5 py-1 rounded-md transition font-medium cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <span>⚡ Pilih: {p.name} ({p.unit})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chips Katalog Gudang (Pilih Cepat) */}
                  {initialData.gudangIntegration.products.length > 0 && !productMatch && productSuggestions.length === 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                      <span className="text-[10px] text-slate-400">Pilih dari Gudang:</span>
                      {initialData.gudangIntegration.products.slice(0, 4).map((p: any) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyProductToNewPo(p)}
                          className="bg-white border border-slate-200 hover:border-emerald-400 hover:text-emerald-700 px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer text-slate-600 truncate max-w-[180px]"
                        >
                          + {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Kolom Satuan Barang, Jumlah Pesanan & Harga Satuan */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Satuan Barang (Unit) *
                    </label>
                    <input
                      type="text"
                      list="purchasing-units-datalist"
                      required
                      placeholder="pcs, box, kg, ton..."
                      value={newPoForm.unit}
                      onChange={(e) => setNewPoForm({ ...newPoForm, unit: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm outline-none focus:border-emerald-500 font-medium"
                    />
                    <datalist id="purchasing-units-datalist">
                      <option value="pcs" />
                      <option value="unit" />
                      <option value="box" />
                      <option value="roll" />
                      <option value="meter" />
                      <option value="kg" />
                      <option value="ton" />
                      <option value="zak" />
                      <option value="liter" />
                      <option value="dus" />
                      <option value="pack" />
                      <option value="set" />
                      <option value="batang" />
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah Pesanan *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newPoForm.quantity}
                      onChange={(e) => setNewPoForm({ ...newPoForm, quantity: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Harga Satuan (Rp) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newPoForm.unitPrice}
                      onChange={(e) => setNewPoForm({ ...newPoForm, unitPrice: Number(e.target.value) })}
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* BAGIAN 3: KALKULASI BIAYA & TARIF PPN RESMI INDONESIA (pajak.go.id) */}
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

                {/* Rincian Kalkulasi Pajak */}
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Barang:</span>
                    <span className="font-semibold text-slate-800">
                      {formatRupiah(newPoForm.quantity * newPoForm.unitPrice)}
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
                      {formatRupiah(
                        Math.round(
                          newPoForm.quantity *
                            newPoForm.unitPrice *
                            (newPoForm.taxRate / 100)
                        )
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-black text-emerald-700">
                    <span>Total Tagihan (Termasuk PPN):</span>
                    <span>
                      {formatRupiah(
                        Math.round(
                          newPoForm.quantity *
                            newPoForm.unitPrice *
                            (1 + newPoForm.taxRate / 100)
                        )
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Estimasi Tanggal Kirim</label>
                <input
                  type="date"
                  value={newPoForm.expectedDeliveryDate}
                  onChange={(e) => setNewPoForm({ ...newPoForm, expectedDeliveryDate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-emerald-500"
                />
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
                <p className="text-[11px] text-slate-400 mt-0.5">Tanggal: {formatDate(previewPoModal.createdAt)}</p>
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

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Diterbitkan secara sah oleh: <b>{previewPoModal.createdBy}</b>
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-slate-900 hover:bg-black text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Purchase Order</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BUKTI PENERIMAAN / KEDATANGAN BARANG DARI GUDANG */}
      {selectedDeliveryProof && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <button
              type="button"
              onClick={() => setSelectedDeliveryProof(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                  Konfirmasi Kedatangan Barang
                </span>
                <h2 className="text-lg font-black text-slate-900 mt-0.5">
                  Bukti Penerimaan Fisik {selectedDeliveryProof.poNumber}
                </h2>
              </div>
            </div>

            {/* Data Gudang & Penerima */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pemasok / Vendor:</span>
                <p className="font-bold text-slate-900 text-sm">{selectedDeliveryProof.supplierName}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Lokasi Gudang Penerima:</span>
                <p className="font-bold text-slate-900 text-sm">
                  🏢 {selectedDeliveryProof.receivedWarehouse || "Gudang Utama Jakarta"}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Petugas Penerima Gudang:</span>
                <p className="font-semibold text-emerald-800">
                  👤 {selectedDeliveryProof.receivedBy || "Staf Penerimaan Gudang"}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Waktu Barang Sampai:</span>
                <p className="font-semibold text-slate-700">
                  🕒 {formatDate(selectedDeliveryProof.receivedAt)}
                </p>
              </div>
            </div>

            {/* Catatan Fisik Gudang */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 text-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-800 block mb-1">
                Catatan Pemeriksaan Fisik Staf Gudang:
              </span>
              <p className="text-slate-800 font-medium italic">
                "{selectedDeliveryProof.receiptNotes || "Barang pesanan telah tiba lengkap, fisik utuh dan sesuai dengan spesifikasi PO."}"
              </p>
            </div>

            {/* Foto Bukti Fisik dengan Cap Watermark Timestamp */}
            <div>
              <span className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center justify-between">
                <span>Foto Bukti Fisik Barang / Surat Jalan dari Gudang:</span>
                {selectedDeliveryProof.receiptTimestamp && (
                  <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                    Timestamp: {selectedDeliveryProof.receiptTimestamp}
                  </span>
                )}
              </span>

              {selectedDeliveryProof.receiptPhotoUrl ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-900">
                  <img
                    src={selectedDeliveryProof.receiptPhotoUrl}
                    alt="Bukti Kedatangan Gudang"
                    className="w-full object-contain max-h-72 mx-auto"
                  />
                  <div className="p-2.5 bg-slate-900/90 text-white flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <BadgeCheck className="w-4 h-4" />
                      <span>Terverifikasi GPS & Timestamp Gudang</span>
                    </span>
                    <span>{selectedDeliveryProof.receiptTimestamp || "Waktu Otomatis"}</span>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-100 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
                  <Package className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p>Penerimaan telah diverifikasi secara sah oleh sistem gudang.</p>
                </div>
              )}
            </div>

            {/* Rincian Barang yang Masuk */}
            {selectedDeliveryProof.items && selectedDeliveryProof.items.length > 0 && (
              <div className="border-t border-slate-100 pt-3">
                <span className="text-xs font-bold text-slate-800 block mb-2">Rincian Barang yang Diterima Masuk:</span>
                <div className="space-y-1.5">
                  {selectedDeliveryProof.items.map((it: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-xs">
                      <span className="font-semibold text-slate-800">• {it.productName}</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded">
                        +{it.quantity} {it.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDeliveryProof(null)}
                className="bg-slate-900 hover:bg-black text-white px-5 py-2 rounded-xl text-xs font-bold cursor-pointer transition"
              >
                Tutup
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
    </div>
  );
}
