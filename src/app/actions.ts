"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  checkGudangConnection,
  getGudangProducts,
  getGudangLowStock,
  getGudangRequisitions,
  getGudangOrders,
  pushPOToGudang,
} from "@/lib/gudangApi";
import {
  getActiveTaxSetting,
  syncOfficialIndonesianTax,
  INDONESIAN_TAX_CATEGORIES,
} from "@/lib/pajakIndonesiaApi";
import {
  getTelegramConfig,
  sendTelegramMessage,
  broadcastToPurchasingStaff,
  sendTelegramTestMessage,
} from "@/lib/telegram";
import {
  checkNineRouterHealth,
  getNineRouterConfigDto,
  getRawNineRouterConfig,
  normalizeNineRouterUrls,
} from "@/lib/nineRouter";
import { DEFAULT_PURCHASING_PREFS, parsePurchasingPrefs } from "@/lib/dashboardPrefs";
import {
  clearUserSessionCookie,
  getVerifiedUserSession,
  setUserSessionCookie,
} from "@/lib/session";

async function assertSelfStaffSession(requestedIdCard: string) {
  const session = await getVerifiedUserSession();
  if (!session) {
    return {
      ok: false as const,
      requiresRelogin: true,
      error:
        "Sesi keamanan login Anda belum terverifikasi. Silakan Log Out lalu masuk kembali dengan ID Card Anda.",
    };
  }
  const cleanRequested = requestedIdCard.trim().toUpperCase();
  if (cleanRequested && cleanRequested !== session.idCard) {
    return {
      ok: false as const,
      requiresRelogin: false,
      error: `Akses dibatasi: Anda login sebagai ${session.idCard} dan hanya berwenang mengubah dashboard akun Anda sendiri.`,
    };
  }
  return { ok: true as const, session };
}

export async function logoutStaffSession() {
  await clearUserSessionCookie();
  return { success: true };
}

// 1. Autentikasi Menggunakan Nomor ID Card Karyawan Purchasing
export async function loginStaffWithIdCard(idCard: string) {
  if (!idCard || !idCard.trim()) {
    return { success: false, error: "Nomor ID Card wajib diisi." };
  }

  const cleanId = idCard.trim().toUpperCase();
  let staff = await prisma.purchasingStaff.findFirst({
    where: {
      idCard: {
        equals: cleanId,
      },
    },
  });

  // Toleransi tanda strip / spasi (misal: PUR001 cocok dengan PUR-001)
  if (!staff) {
    const stripped = cleanId.replace(/[^A-Z0-9]/g, "");
    const all = await prisma.purchasingStaff.findMany();
    staff =
      all.find(
        (s) => s.idCard.replace(/[^A-Z0-9]/gi, "").toUpperCase() === stripped
      ) || null;
  }

  if (!staff) {
    return {
      success: false,
      error: `Nomor ID Card "${cleanId}" tidak ditemukan. Pastikan Anda memasukkan nomor ID Card resmi staf Purchasing.`,
    };
  }

  await setUserSessionCookie({
    idCard: staff.idCard,
    userId: staff.id,
    role: staff.role,
  });

  return {
    success: true,
    user: {
      id: staff.id,
      idCard: staff.idCard,
      name: staff.name,
      position: staff.position,
      role: staff.role,
      telegramChatId: staff.telegramChatId,
      telegramUsername: staff.telegramUsername,
      telegramEnabled: staff.telegramEnabled,
      dashboardConfigJson: staff.dashboardConfigJson || null,
    },
  };
}

// 2. Ambil Seluruh Data Dashboard Purchasing Terintegrasi
export async function getPurchasingDashboardData() {
  const [
    staffList,
    vendors,
    purchaseOrders,
    deliveryNotifications,
    taxSetting,
    gudangStatus,
    gudangProducts,
    gudangLowStock,
    gudangPRs,
    gudangOrders,
    vendorPrices,
    activityLogs,
  ] = await Promise.all([
    prisma.purchasingStaff.findMany({ orderBy: { idCard: "asc" } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.deliveryNotification.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getActiveTaxSetting(),
    checkGudangConnection(),
    getGudangProducts(),
    getGudangLowStock(),
    getGudangRequisitions(),
    getGudangOrders(),
    prisma.vendorPriceItem.findMany({ orderBy: [{ productName: "asc" }, { unitPrice: "asc" }] }),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  // Seed default Riwayat Aktivitas jika belum ada
  let activeLogs = activityLogs;
  if (activeLogs.length === 0) {
    const defaultLogs = [
      {
        type: "PRICE_UPDATE",
        title: "Pembaruan Harga Bahan Baku",
        description: "PT Chandra Asri Petrochemical Tbk memperbarui harga Biji Plastik HDPE Virgin Granule menjadi Rp 26.500.000 / ton (Pricelist Resmi Kuartal IV).",
        actor: "Rian Pratama",
        actorRole: "Manajer Pengadaan",
        referenceId: "PT Chandra Asri Petrochemical Tbk",
        createdAt: new Date(Date.now() - 3600000 * 5),
      },
      {
        type: "PO_CREATED",
        title: "Penerbitan PO-2026-003",
        description: "Penerbitan PO resmi ke PT Chandra Asri Petrochemical Tbk senilai Rp 277.500.000 untuk pengadaan 10 Ton Biji Plastik HDPE (Termin: Tempo 30 Hari).",
        actor: "Rian Pratama",
        actorRole: "Manajer Pengadaan",
        referenceId: "PO-2026-003",
        createdAt: new Date(Date.now() - 3600000 * 4),
      },
      {
        type: "WAREHOUSE_RECEIVED",
        title: "Kedatangan Barang di Gudang",
        description: "Barang PO-2026-003 telah sampai dan diterima lengkap di Gudang Utama oleh Staf Gudang.",
        actor: "Budi Santoso",
        actorRole: "Kepala Gudang",
        referenceId: "PO-2026-003",
        createdAt: new Date(Date.now() - 3600000 * 3),
      },
      {
        type: "PAYMENT_RECORDED",
        title: "Pelunasan Pembayaran Kasir",
        description: "Kasir mencatat pembayaran lunas senilai Rp 277.500.000 untuk PO-2026-003 via Transfer Bank BCA operasional.",
        actor: "Maya Indah Sari",
        actorRole: "Kasir Purchasing",
        referenceId: "PO-2026-003",
        createdAt: new Date(Date.now() - 3600000 * 2),
      },
      {
        type: "PRICE_UPDATE",
        title: "Sinkronisasi Harga Kabel Tembaga",
        description: "Toko Kabel Jaya Makmur Glodok menyinkronkan harga penawaran Kabel Tembaga NYY 4x16mm menjadi Rp 110.000 / meter (SNI Standar PLN).",
        actor: "Maya Indah Sari",
        actorRole: "Staf Pengadaan",
        referenceId: "Toko Kabel Jaya Makmur Glodok",
        createdAt: new Date(Date.now() - 3600000 * 1.5),
      },
      {
        type: "TAX_SYNC",
        title: "Sinkronisasi Regulasi Pajak DJP",
        description: "Regulasi PPN 12% disinkronkan otomatis sesuai UU No. 7 Tahun 2021 & PMK No. 131 Tahun 2024 dari portal pajak.go.id.",
        actor: "Sistem Otomatis",
        actorRole: "Integrasi Pajak DJP",
        referenceId: "UU HPP",
        createdAt: new Date(Date.now() - 3600000 * 1),
      },
    ];

    for (const log of defaultLogs) {
      await prisma.activityLog.create({ data: log });
    }

    activeLogs = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  // Seed default Katalog Harga Bahan Baku Vendor jika belum ada data
  let activeVendorPrices = vendorPrices;
  if (activeVendorPrices.length === 0) {
    const defaultQuotes = [
      {
        productName: "Biji Plastik HDPE Virgin Granule",
        category: "Bahan Baku Plastik",
        vendorName: "PT Chandra Asri Petrochemical Tbk",
        vendorPhone: "021-5307950",
        vendorWhatsapp: "081199223344",
        vendorAddress: "Wisma Barito Pacific Tower B, Jl. Letjen S. Parman Kav 62-63, Jakarta Barat",
        unit: "ton",
        unitPrice: 26500000,
        minOrderQty: 2,
        leadTimeDays: 2,
        paymentTerms: "TEMPO_30",
        grade: "HDPE Virgin Blow Moulding Grade",
        notes: "Melt Flow Rate 0.05, kemasan zak 25kg palletized, COA resmi pabrik.",
        isBestPrice: true,
      },
      {
        productName: "Biji Plastik HDPE Virgin Granule",
        category: "Bahan Baku Plastik",
        vendorName: "PT Lotte Chemical Titan Tbk",
        vendorPhone: "021-57851860",
        vendorWhatsapp: "081288334455",
        vendorAddress: "Setiabudi Atrium Lt. 8, Jl. HR Rasuna Said Kav 62, Jakarta Selatan",
        unit: "ton",
        unitPrice: 27400000,
        minOrderQty: 5,
        leadTimeDays: 3,
        paymentTerms: "TEMPO_60",
        grade: "HDPE Titanven HD5218AA Injection Grade",
        notes: "Kepadatan 0.954 g/cm3, sertifikasi Food Grade FDA approved.",
        isBestPrice: false,
      },
      {
        productName: "Biji Plastik HDPE Virgin Granule",
        category: "Bahan Baku Plastik",
        vendorName: "CV Plastindo Mandiri Cikarang",
        vendorPhone: "021-8983000",
        vendorWhatsapp: "081388997700",
        vendorAddress: "Kawasan Industri Delta Silicon 3, Lippo Cikarang, Bekasi",
        unit: "ton",
        unitPrice: 28200000,
        minOrderQty: 1,
        leadTimeDays: 1,
        paymentTerms: "COD",
        grade: "HDPE Prime Reprocessed Blend",
        notes: "Cocok untuk ember, botol industri, dan pipa non-food.",
        isBestPrice: false,
      },
      {
        productName: "Kabel Tembaga Industri NYY 4x16mm",
        category: "Komponen & Listrik",
        vendorName: "Toko Kabel Jaya Makmur Glodok",
        vendorPhone: "081377889900",
        vendorWhatsapp: "081377889900",
        vendorAddress: "Glodok Plaza Blok B No. 12, Jl. Pinangsia Raya, Jakarta Barat",
        unit: "meter",
        unitPrice: 110000,
        minOrderQty: 50,
        leadTimeDays: 1,
        paymentTerms: "TEMPO_30",
        grade: "SNI 04-6629 Standar PLN",
        notes: "Konduktor tembaga murni 99.9%, isolasi ganda PVC 0.6/1kV.",
        isBestPrice: true,
      },
      {
        productName: "Kabel Tembaga Industri NYY 4x16mm",
        category: "Komponen & Listrik",
        vendorName: "PT Supreme Cable Manufacturing (SUCACO)",
        vendorPhone: "021-6198501",
        vendorWhatsapp: "081299887766",
        vendorAddress: "Jl. Kebon Sirih No. 71, Jakarta Pusat",
        unit: "meter",
        unitPrice: 118500,
        minOrderQty: 200,
        leadTimeDays: 4,
        paymentTerms: "TEMPO_60",
        grade: "Heavy Duty Industrial Grade (SUCACO Original)",
        notes: "Drum kayu bersegel, uji tahan api dan abrasi lingkungan pabrik.",
        isBestPrice: false,
      },
      {
        productName: "Pelat Baja Lembaran Hot Rolled Coil (HRC)",
        category: "Logam & Manufaktur",
        vendorName: "PT Krakatau Steel Tbk",
        vendorPhone: "0254-392000",
        vendorWhatsapp: "081299112233",
        vendorAddress: "Kawasan Industri Krakatau, Jl. Industri No. 5, Cilegon, Banten",
        unit: "kg",
        unitPrice: 15800,
        minOrderQty: 1000,
        leadTimeDays: 5,
        paymentTerms: "TEMPO_30",
        grade: "JIS G3101 SS400 (Tebal 3.0mm - 12.0mm)",
        notes: "Mill Test Certificate (MTC) terlampir, toleransi ketebalan presisi.",
        isBestPrice: true,
      },
      {
        productName: "Pelat Baja Lembaran Hot Rolled Coil (HRC)",
        category: "Logam & Manufaktur",
        vendorName: "PT Gunung Raja Paksi Tbk",
        vendorPhone: "021-89840999",
        vendorWhatsapp: "081122334455",
        vendorAddress: "Jl. Perjuangan No. 8, Sukadanau, Cikarang Barat, Bekasi",
        unit: "kg",
        unitPrice: 16400,
        minOrderQty: 500,
        leadTimeDays: 2,
        paymentTerms: "TEMPO_14",
        grade: "ASTM A36 Structural Steel Coil",
        notes: "Siap potong lembaran sesuai pesanan (*custom slitting*).",
        isBestPrice: false,
      },
      {
        productName: "Bahan Kimia Isopropyl Alcohol (IPA 99.8%)",
        category: "Bahan Kimia & Pelarut",
        vendorName: "PT Lautan Luas Tbk",
        vendorPhone: "021-53677777",
        vendorWhatsapp: "081234567800",
        vendorAddress: "Graha Lautan Luas, Jl. Kebon Jeruk Raya No. 40, Jakarta Barat",
        unit: "drum",
        unitPrice: 3250000,
        minOrderQty: 2,
        leadTimeDays: 2,
        paymentTerms: "TEMPO_30",
        grade: "Electronic & Industrial Grade 99.8%",
        notes: "Drum besi 200 Liter, MSDS & COA lengkap, pembersih gemuk dan pelarut tinta.",
        isBestPrice: true,
      },
      {
        productName: "Karton Box Corrugated (40x30x30 cm)",
        category: "Kemasan & Packaging",
        vendorName: "PT Fajar Surya Wisesa Tbk",
        vendorPhone: "021-89830500",
        vendorWhatsapp: "081388776655",
        vendorAddress: "Jl. Abdul Muis No. 30, Jakarta Pusat (Pabrik: Cikarang Barat)",
        unit: "pcs",
        unitPrice: 7800,
        minOrderQty: 500,
        leadTimeDays: 3,
        paymentTerms: "TEMPO_30",
        grade: "Double Wall K150/M125/K150 (Flute B/C)",
        notes: "Kuat tumpukan hingga 5 tingkat, tahan benturan ekspedisi.",
        isBestPrice: true,
      },
    ];

    for (const q of defaultQuotes) {
      await prisma.vendorPriceItem.create({ data: q });
    }

    activeVendorPrices = await prisma.vendorPriceItem.findMany({
      orderBy: [{ productName: "asc" }, { unitPrice: "asc" }],
    });
  }

  // Rekonsiliasi Otomatis Real-time: jika gudang telah menerima barang (status RECEIVED),
  // pastikan database Purchasing langsung tersinkronkan
  if (Array.isArray(gudangOrders) && gudangOrders.length > 0) {
    for (const gPo of gudangOrders) {
      if (gPo.status === "RECEIVED") {
        const local = purchaseOrders.find((p) => p.poNumber === gPo.poNumber);
        if (local && local.status !== "RECEIVED") {
          await prisma.purchaseOrder.update({
            where: { poNumber: gPo.poNumber },
            data: {
              status: "RECEIVED",
              receivedAt: gPo.receivedAt ? new Date(gPo.receivedAt) : new Date(),
              receivedBy: gPo.receivedBy || "Staf Gudang",
              receivedWarehouse: gPo.receivedWarehouse || "Gudang Utama",
              receiptNotes: gPo.receiptNotes || "Barang telah diterima di gudang",
              receiptPhotoUrl: gPo.receiptPhotoUrl || null,
              receiptTimestamp: gPo.receiptTimestamp || null,
            },
          });
          local.status = "RECEIVED";
          local.receivedAt = gPo.receivedAt ? new Date(gPo.receivedAt) : new Date();
          local.receivedBy = gPo.receivedBy || "Staf Gudang";
          local.receivedWarehouse = gPo.receivedWarehouse || "Gudang Utama";
          local.receiptNotes = gPo.receiptNotes || "Barang telah diterima di gudang";
          local.receiptPhotoUrl = gPo.receiptPhotoUrl || null;
          local.receiptTimestamp = gPo.receiptTimestamp || null;
        }
      }
    }
  }

  // Kalkulasi statistik keuangan & status PO
  let totalSpending = 0;
  let totalPaid = 0;
  let totalUnpaid = 0;
  let approvedCount = 0;
  let receivedCount = 0;
  let unpaidCount = 0;
  let paidCount = 0;

  for (const po of purchaseOrders) {
    totalSpending += po.totalAmount;
    const paid = po.paidAmount || (po.paymentStatus === "PAID" ? po.totalAmount : 0);
    totalPaid += paid;
    totalUnpaid += Math.max(0, po.totalAmount - paid);

    if (po.paymentStatus === "PAID") {
      paidCount++;
    } else {
      unpaidCount++;
    }

    if (po.status === "APPROVED") approvedCount++;
    if (po.status === "RECEIVED") receivedCount++;
  }

  return {
    staffList,
    vendors,
    deliveryNotifications,
    taxSetting,
    telegramConfig: await getTelegramConfig(),
    nineRouterConfig: await getNineRouterConfigDto(),
    vendorPrices: activeVendorPrices,
    activityLogs: activeLogs,
    purchaseOrders: purchaseOrders.map((po) => ({
      ...po,
      items: JSON.parse(po.itemsJson || "[]"),
    })),
    gudangIntegration: {
      connected: gudangStatus.connected,
      apiUrl: process.env.GUDANG_API_URL || "http://localhost:3000",
      products: gudangProducts,
      lowStockItems: gudangLowStock,
      requisitions: gudangPRs,
    },
    stats: {
      totalSpending,
      totalPaid,
      totalUnpaid,
      unpaidCount,
      paidCount,
      totalPOs: purchaseOrders.length,
      approvedCount,
      receivedCount,
      totalVendors: vendors.length,
      lowStockGudangCount: gudangLowStock.length,
      pendingPRsGudangCount: gudangPRs.filter((pr: any) => pr.status === "SUBMITTED").length,
      unreadDeliveriesCount: deliveryNotifications.filter((n) => !n.read).length,
      totalActivities: activeLogs.length,
    },
  };
}

// Helper Pencatatan Audit Log & Riwayat Aktivitas Sistem Purchasing
export async function logActivity(data: {
  type: string;
  title: string;
  description: string;
  actor?: string;
  actorRole?: string;
  referenceId?: string;
  metadata?: any;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        type: data.type,
        title: data.title,
        description: data.description,
        actor: data.actor || "Tim Purchasing",
        actorRole: data.actorRole || "Staf Pengadaan",
        referenceId: data.referenceId || null,
        metadataJson: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
  } catch (e) {
    console.error("Gagal mencatat audit log aktivitas:", e);
  }
}

// Tandai notifikasi kedatangan barang telah dibaca
export async function markNotificationAsRead(id: string) {
  try {
    await prisma.deliveryNotification.update({
      where: { id },
      data: { read: true },
    });
    revalidatePath("/");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function markAllNotificationsAsRead() {
  try {
    await prisma.deliveryNotification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    revalidatePath("/");
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 3. Terbitkan Purchase Order (PO) Baru & Kirim ke Gudang
export async function createPurchaseOrder(data: {
  supplierName: string;
  supplierPhone?: string;
  supplierWhatsapp?: string;
  supplierAddress?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  createdBy: string;
  taxRate?: number;
  taxLegalBasis?: string;
  paymentTerms?: string;
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID";
  paidAmount?: number;
  paymentMethod?: string;
  paymentNotes?: string;
  syncPricesToCatalog?: boolean;
  items: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
}) {
  if (!data.supplierName || !data.items || !data.items.length) {
    throw new Error("Pilih vendor dan minimal satu produk untuk membuat PO.");
  }

  // Otomatis daftarkan vendor / perusahaan ke direktori master jika belum ada
  if (data.supplierName.trim()) {
    try {
      const existing = await prisma.vendor.findFirst({
        where: { name: { equals: data.supplierName.trim() } },
      });
      if (!existing) {
        await prisma.vendor.create({
          data: {
            name: data.supplierName.trim(),
            phone: data.supplierPhone || null,
            whatsapp: data.supplierWhatsapp || data.supplierPhone || null,
            address: data.supplierAddress || null,
          },
        });
      }
    } catch (e) {
      // ignore unique constraint
    }
  }

  // Ambil regulasi tarif PPN resmi Indonesia (pajak.go.id)
  const activeTax = await getActiveTaxSetting();
  const finalTaxRate = data.taxRate !== undefined ? Number(data.taxRate) : activeTax.rate;
  const finalTaxLegalBasis = data.taxLegalBasis || activeTax.legalBasis;

  // Hitung subtotal, pajak PPN dinamis dari DJP/Kemenkeu, dan total amount
  let subtotal = 0;
  const itemsWithSubtotal = data.items.map((it) => {
    const itemSub = Number(it.quantity) * Number(it.unitPrice || 0);
    subtotal += itemSub;
    return {
      productId: it.productId || "",
      productName: it.productName,
      quantity: Number(it.quantity),
      unit: it.unit || "pcs",
      unitPrice: Number(it.unitPrice || 0),
      subtotal: itemSub,
    };
  });

  const tax = Math.round(subtotal * (finalTaxRate / 100)); // PPN dinamis sesuai regulasi resmi
  const totalAmount = subtotal + tax;

  const count = await prisma.purchaseOrder.count();
  const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(3, "0")}`;

  // Logika Kasir & Pembayaran Awal
  const paymentTerms = data.paymentTerms || "TEMPO_30";
  let paidAmount = data.paidAmount !== undefined ? Math.max(0, Number(data.paidAmount)) : 0;
  let paymentStatus = data.paymentStatus || "UNPAID";

  if (paymentTerms === "CASH" && data.paymentStatus === "PAID") {
    paidAmount = totalAmount;
  } else if (paymentTerms === "DP_50" && (!data.paidAmount || data.paidAmount === 0)) {
    paidAmount = Math.round(totalAmount * 0.5);
    paymentStatus = "PARTIAL";
  }

  if (paidAmount >= totalAmount && totalAmount > 0) {
    paymentStatus = "PAID";
  } else if (paidAmount > 0) {
    paymentStatus = "PARTIAL";
  }

  // 1. Simpan di database Purchasing dengan tarif PPN resmi, dasar hukum, dan data pembayaran
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      createdAt: data.orderDate ? new Date(data.orderDate) : undefined,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone || null,
      supplierAddress: data.supplierAddress || null,
      status: "APPROVED",
      subtotal,
      taxRate: finalTaxRate,
      tax,
      totalAmount,
      taxLegalBasis: finalTaxLegalBasis,
      notes: data.notes || "Pesanan resmi diterbitkan oleh Tim Purchasing",
      expectedDeliveryDate: data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : undefined,
      createdBy: data.createdBy || "Tim Purchasing",
      itemsJson: JSON.stringify(itemsWithSubtotal),
      paymentTerms,
      paymentStatus,
      paidAmount,
      paymentMethod: data.paymentMethod || (paymentStatus === "PAID" ? "TRANSFER_BANK" : null),
      paymentNotes: data.paymentNotes || null,
      paymentRecordedBy: paymentStatus !== "UNPAID" ? (data.createdBy || "Kasir Purchasing") : null,
      paymentDate: paymentStatus !== "UNPAID" ? new Date() : null,
    },
  });

  // 1.5 Otomatis Sinkronkan Harga Baru ke Katalog Vendor jika dipilih oleh staf
  if (data.syncPricesToCatalog) {
    for (const it of itemsWithSubtotal) {
      if (it.unitPrice > 0) {
        try {
          const matchedItem = await prisma.vendorPriceItem.findFirst({
            where: {
              productName: { equals: it.productName.trim() },
              vendorName: { equals: data.supplierName.trim() },
            },
          });
          if (matchedItem && matchedItem.unitPrice !== it.unitPrice) {
            let hist: any[] = [];
            try { hist = JSON.parse(matchedItem.priceHistoryJson || "[]"); } catch {}
            hist.unshift({
              oldPrice: matchedItem.unitPrice,
              newPrice: it.unitPrice,
              diff: it.unitPrice - matchedItem.unitPrice,
              percentDiff: Number((((it.unitPrice - matchedItem.unitPrice) / matchedItem.unitPrice) * 100).toFixed(2)),
              changedAt: new Date().toISOString(),
              reason: `Sinkronisasi otomatis saat terbitkan PO ${poNumber}`,
              changedBy: data.createdBy || "Tim Purchasing",
            });
            await prisma.vendorPriceItem.update({
              where: { id: matchedItem.id },
              data: {
                previousPrice: matchedItem.unitPrice,
                unitPrice: it.unitPrice,
                lastUpdatedBy: data.createdBy || "Tim Purchasing",
                priceChangeReason: `Sinkronisasi otomatis dari PO ${poNumber}`,
                priceHistoryJson: JSON.stringify(hist.slice(0, 20)),
              },
            });
          }
        } catch (err) {
          console.error("Gagal sinkronkan harga PO ke katalog vendor:", err);
        }
      }
    }
  }

  // 2. Kirim otomatis ke Project Gudang agar staf gudang tahu ada barang yang akan datang
  try {
    await pushPOToGudang({
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      supplierPhone: po.supplierPhone || undefined,
      supplierAddress: po.supplierAddress || undefined,
      notes: po.notes || undefined,
      expectedDate: data.expectedDeliveryDate,
      items: itemsWithSubtotal.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        quantity: it.quantity,
        unit: it.unit,
        price: it.unitPrice,
      })),
    });
  } catch (e) {
    // Tetap berhasil di Purchasing jika Gudang sementara offline
    console.warn("Gudang sync notification delayed:", e);
  }

  // 3. Catat audit log aktivitas
  await logActivity({
    type: "PO_CREATED",
    title: `Penerbitan PO ${po.poNumber}`,
    description: `PO ${po.poNumber} berhasil diterbitkan kepada "${po.supplierName}" senilai Rp ${totalAmount.toLocaleString("id-ID")} (${itemsWithSubtotal.length} jenis barang). Termin: ${paymentTerms}. Status Bayar: ${paymentStatus}.`,
    actor: data.createdBy || "Tim Purchasing",
    actorRole: "Staf Pengadaan",
    referenceId: po.poNumber,
    metadata: {
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      totalAmount,
      paymentStatus,
      paymentTerms,
      itemsCount: itemsWithSubtotal.length,
    },
  });

  // 4. Kirim notifikasi Telegram ke Staf Purchasing yang terhubung
  try {
    const poMsg =
      `📦 *PURCHASE ORDER BARU DITERBITKAN*\n\n` +
      `No. PO: *${po.poNumber}*\n` +
      `Vendor: *${po.supplierName}*\n` +
      `Total Nilai: *Rp ${totalAmount.toLocaleString("id-ID")}* (${itemsWithSubtotal.length} barang)\n` +
      `Status Bayar: *${paymentStatus}* (${paymentTerms})\n` +
      `Dibuat Oleh: *${data.createdBy || "Tim Purchasing"}*\n` +
      `Target Pengiriman: ${data.expectedDeliveryDate || "Sesuai Jadwal"}\n\n` +
      `Data telah disinkronkan otomatis ke modul Gudang.`;
    await broadcastToPurchasingStaff(poMsg);
  } catch (err) {
    console.warn("Telegram broadcast PO error:", err);
  }

  revalidatePath("/");
  return po;
}

// 4. Sinkronisasi Langsung dari Portal Pajak Indonesia (pajak.go.id / Kemenkeu)
export async function syncTaxFromPajakIndonesia() {
  const result = await syncOfficialIndonesianTax();
  if (result.success && result.data) {
    await logActivity({
      type: "TAX_SYNC",
      title: `Sinkronisasi Regulasi Pajak DJP (${result.data.rate}%)`,
      description: `Regulasi tarif PPN ${result.data.rate}% berhasil disinkronkan langsung dari portal resmi DJP/Kemenkeu (${result.data.legalBasis}).`,
      actor: "Sistem Otomatis",
      actorRole: "Integrasi Pajak DJP",
      referenceId: "DJP PPN",
      metadata: { rate: result.data.rate, legalBasis: result.data.legalBasis },
    });
  }
  revalidatePath("/");
  return result;
}

// 5. Update Penyesuaian Tarif Pajak oleh Manager
export async function updateManualTaxRate(data: {
  rate: number;
  effectiveRate?: number;
  legalBasis: string;
  notes?: string;
}) {
  const setting = await prisma.taxSetting.findFirst();
  if (setting) {
    await prisma.taxSetting.update({
      where: { id: setting.id },
      data: {
        rate: Number(data.rate),
        effectiveRate: data.effectiveRate !== undefined ? Number(data.effectiveRate) : setting.effectiveRate,
        legalBasis: data.legalBasis,
        notes: data.notes || setting.notes,
        lastSyncedAt: new Date(),
        syncStatus: "MANUAL_UPDATED",
      },
    });
  } else {
    await prisma.taxSetting.create({
      data: {
        taxName: "PPN (Pajak Pertambahan Nilai)",
        rate: Number(data.rate),
        effectiveRate: data.effectiveRate !== undefined ? Number(data.effectiveRate) : 11,
        legalBasis: data.legalBasis,
        authority: "Direktorat Jenderal Pajak (DJP) - Kementerian Keuangan RI",
        sourceUrl: "https://pajak.go.id",
        lastSyncedAt: new Date(),
        syncStatus: "MANUAL_UPDATED",
        notes: data.notes || "Tarif PPN disesuaikan secara resmi oleh Purchasing Manager.",
      },
    });
  }
  revalidatePath("/");
  return { success: true };
}

// 4. Tambah Master Vendor Baru
export async function createVendor(data: {
  name: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
  category?: string;
}) {
  if (!data.name || !data.name.trim()) {
    throw new Error("Nama vendor wajib diisi.");
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      whatsapp: data.whatsapp?.trim() || null,
      address: data.address?.trim() || null,
      category: data.category?.trim() || "Material & Logistik",
    },
  });

  await logActivity({
    type: "VENDOR_REGISTERED",
    title: `Pendaftaran Vendor Baru: ${vendor.name}`,
    description: `Vendor "${vendor.name}" (${vendor.category}) berhasil didaftarkan ke direktori pemasok Purchasing. Kontak: ${vendor.phone || vendor.whatsapp || "-"}.`,
    actor: "Staf Pengadaan",
    actorRole: "Administrasi Vendor",
    referenceId: vendor.name,
    metadata: { vendorId: vendor.id, vendorName: vendor.name, category: vendor.category },
  });

  revalidatePath("/");
  return vendor;
}

// 5. Tambah Staf Purchasing Baru
export async function createStaffIdCard(data: {
  idCard: string;
  name: string;
  position?: string;
  role?: string;
}) {
  if (!data.idCard?.trim() || !data.name?.trim()) {
    throw new Error("Nomor ID Card dan Nama Staf wajib diisi.");
  }

  const cleanId = data.idCard.trim().toUpperCase();
  const staff = await prisma.purchasingStaff.create({
    data: {
      idCard: cleanId,
      name: data.name.trim(),
      position: data.position?.trim() || "Staf Pengadaan",
      role: data.role || "STAFF",
    },
  });

  revalidatePath("/");
  return staff;
}

// 6. Pencatatan Kasir & Pembayaran PO
export async function recordPoPayment(data: {
  poId: string;
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  paidAmount: number;
  paymentMethod?: string;
  paymentTerms?: string;
  paymentNotes?: string;
  paymentRecordedBy: string;
  paymentProofUrl?: string;
}) {
  try {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: data.poId } });
    if (!po) throw new Error("Purchase Order tidak ditemukan.");

    const finalPaidAmount = Math.max(0, Number(data.paidAmount));
    let finalStatus: string = data.paymentStatus;
    if (finalPaidAmount >= po.totalAmount && po.totalAmount > 0) {
      finalStatus = "PAID";
    } else if (finalPaidAmount > 0) {
      finalStatus = "PARTIAL";
    } else {
      finalStatus = "UNPAID";
    }

    await prisma.purchaseOrder.update({
      where: { id: data.poId },
      data: {
        paymentStatus: finalStatus,
        paidAmount: finalPaidAmount,
        paymentMethod: data.paymentMethod || po.paymentMethod || "TRANSFER_BANK",
        paymentTerms: data.paymentTerms || po.paymentTerms || "TEMPO_30",
        paymentNotes: data.paymentNotes || null,
        paymentProofUrl: data.paymentProofUrl || po.paymentProofUrl || null,
        paymentRecordedBy: data.paymentRecordedBy || "Kasir Purchasing",
        paymentDate: finalStatus === "UNPAID" ? null : new Date(),
      },
    });

    await logActivity({
      type: "PAYMENT_RECORDED",
      title: `Catatan Pembayaran PO ${po.poNumber} (${finalStatus})`,
      description: `Kasir mencatat pembayaran senilai Rp ${finalPaidAmount.toLocaleString("id-ID")} untuk ${po.poNumber} (${po.supplierName}). Metode: ${data.paymentMethod || "TRANSFER_BANK"}. Status: ${finalStatus}. Catatan: ${data.paymentNotes || "-"}`,
      actor: data.paymentRecordedBy || "Kasir Purchasing",
      actorRole: "Kasir Finansial Purchasing",
      referenceId: po.poNumber,
      metadata: {
        poNumber: po.poNumber,
        paidAmount: finalPaidAmount,
        totalAmount: po.totalAmount,
        paymentStatus: finalStatus,
        paymentMethod: data.paymentMethod || "TRANSFER_BANK",
      },
    });

    revalidatePath("/");
    return { success: true, message: `Status pembayaran PO ${po.poNumber} berhasil diperbarui!` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 7. Pengelolaan Katalog Penawaran Harga Bahan Baku & Komparasi Vendor
export async function createOrUpdateVendorPrice(data: {
  id?: string;
  productName: string;
  category?: string;
  vendorName: string;
  vendorPhone?: string;
  vendorWhatsapp?: string;
  vendorAddress?: string;
  unit: string;
  unitPrice: number;
  minOrderQty?: number;
  leadTimeDays?: number;
  paymentTerms?: string;
  grade?: string;
  notes?: string;
  priceChangeReason?: string;
  updatedBy?: string;
}) {
  try {
    const cleanProductName = data.productName.trim();
    const cleanVendorName = data.vendorName.trim();

    if (!cleanProductName || !cleanVendorName || data.unitPrice <= 0) {
      return { success: false, error: "Nama produk, nama vendor, dan harga satuan valid wajib diisi." };
    }

    if (data.id) {
      const existing = await prisma.vendorPriceItem.findUnique({ where: { id: data.id } });
      const newPrice = Number(data.unitPrice);
      let prevPrice = existing?.previousPrice || null;
      let historyList: any[] = [];
      try {
        historyList = JSON.parse(existing?.priceHistoryJson || "[]");
      } catch {}

      if (existing && existing.unitPrice !== newPrice) {
        prevPrice = existing.unitPrice;
        const diff = newPrice - existing.unitPrice;
        const percentDiff = Number((((newPrice - existing.unitPrice) / existing.unitPrice) * 100).toFixed(2));
        historyList.unshift({
          oldPrice: existing.unitPrice,
          newPrice,
          diff,
          percentDiff,
          changedAt: new Date().toISOString(),
          reason: data.priceChangeReason || "Update penawaran harga vendor",
          changedBy: data.updatedBy || "Staf Purchasing",
        });
      }

      await prisma.vendorPriceItem.update({
        where: { id: data.id },
        data: {
          productName: cleanProductName,
          category: data.category || "Bahan Baku",
          vendorName: cleanVendorName,
          vendorPhone: data.vendorPhone || null,
          vendorWhatsapp: data.vendorWhatsapp || null,
          vendorAddress: data.vendorAddress || null,
          unit: data.unit || "kg",
          unitPrice: newPrice,
          previousPrice: prevPrice,
          priceChangeReason: data.priceChangeReason || existing?.priceChangeReason || null,
          lastUpdatedBy: data.updatedBy || existing?.lastUpdatedBy || "Staf Purchasing",
          priceHistoryJson: JSON.stringify(historyList.slice(0, 20)),
          minOrderQty: Number(data.minOrderQty) || 1,
          leadTimeDays: Number(data.leadTimeDays) || 3,
          paymentTerms: data.paymentTerms || "TEMPO_30",
          grade: data.grade || null,
          notes: data.notes || null,
        },
      });
    } else {
      await prisma.vendorPriceItem.create({
        data: {
          productName: cleanProductName,
          category: data.category || "Bahan Baku",
          vendorName: cleanVendorName,
          vendorPhone: data.vendorPhone || null,
          vendorWhatsapp: data.vendorWhatsapp || null,
          vendorAddress: data.vendorAddress || null,
          unit: data.unit || "kg",
          unitPrice: Number(data.unitPrice),
          minOrderQty: Number(data.minOrderQty) || 1,
          leadTimeDays: Number(data.leadTimeDays) || 3,
          paymentTerms: data.paymentTerms || "TEMPO_30",
          grade: data.grade || null,
          notes: data.notes || null,
          lastUpdatedBy: data.updatedBy || "Staf Purchasing",
        },
      });
    }

    // Rekalkulasi penanda isBestPrice untuk produk ini
    const allForProduct = await prisma.vendorPriceItem.findMany({
      where: { productName: cleanProductName },
      orderBy: { unitPrice: "asc" },
    });

    if (allForProduct.length > 0) {
      const minPrice = allForProduct[0].unitPrice;
      for (const item of allForProduct) {
        await prisma.vendorPriceItem.update({
          where: { id: item.id },
          data: { isBestPrice: item.unitPrice === minPrice },
        });
      }
    }

    await logActivity({
      type: "PRICE_UPDATE",
      title: data.id ? `Pembaruan Harga: ${cleanProductName}` : `Pendaftaran Harga: ${cleanProductName}`,
      description: `${data.updatedBy || "Staf Purchasing"} ${data.id ? "memperbarui" : "mendaftarkan"} penawaran ${cleanProductName} dari ${cleanVendorName} menjadi Rp ${Number(data.unitPrice).toLocaleString("id-ID")}/${data.unit || "kg"}. Alasan: ${data.priceChangeReason || "Penyesuaian penawaran katalog vendor"}.`,
      actor: data.updatedBy || "Staf Purchasing",
      actorRole: "Staf Pengadaan",
      referenceId: cleanVendorName,
      metadata: {
        productName: cleanProductName,
        vendorName: cleanVendorName,
        unitPrice: Number(data.unitPrice),
        unit: data.unit || "kg",
        reason: data.priceChangeReason || null,
      },
    });

    revalidatePath("/");
    return { success: true, message: `Penawaran harga untuk "${cleanProductName}" dari "${cleanVendorName}" berhasil disimpan & disinkronkan!` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 7.1 Action Sinkronisasi Cepat Perubahan Harga Vendor (Instant Price Sync)
export async function syncVendorPriceChange(data: {
  id: string;
  newPrice: number;
  reason?: string;
  updatedBy: string;
}) {
  try {
    const existing = await prisma.vendorPriceItem.findUnique({ where: { id: data.id } });
    if (!existing) throw new Error("Data penawaran vendor tidak ditemukan.");

    const oldPrice = existing.unitPrice;
    const newPrice = Number(data.newPrice);
    if (!newPrice || newPrice <= 0) throw new Error("Nominal harga baru harus lebih besar dari 0.");

    let history: any[] = [];
    try {
      history = JSON.parse(existing.priceHistoryJson || "[]");
    } catch {}

    const diff = newPrice - oldPrice;
    const percentDiff = Number((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2));
    history.unshift({
      oldPrice,
      newPrice,
      diff,
      percentDiff,
      changedAt: new Date().toISOString(),
      reason: data.reason || "Sinkronisasi perubahan harga vendor",
      changedBy: data.updatedBy || "Staf Purchasing",
    });

    await prisma.vendorPriceItem.update({
      where: { id: data.id },
      data: {
        unitPrice: newPrice,
        previousPrice: oldPrice,
        priceChangeReason: data.reason || "Sinkronisasi perubahan harga vendor",
        lastUpdatedBy: data.updatedBy || "Staf Purchasing",
        priceHistoryJson: JSON.stringify(history.slice(0, 20)),
      },
    });

    // Update isBestPrice status
    const allForProduct = await prisma.vendorPriceItem.findMany({
      where: { productName: existing.productName },
      orderBy: { unitPrice: "asc" },
    });
    if (allForProduct.length > 0) {
      const minPrice = allForProduct[0].unitPrice;
      for (const item of allForProduct) {
        await prisma.vendorPriceItem.update({
          where: { id: item.id },
          data: { isBestPrice: item.unitPrice === minPrice },
        });
      }
    }

    revalidatePath("/");
    const statusNote = diff > 0 ? `naik +${percentDiff}%` : diff < 0 ? `turun ${percentDiff}% (hemat)` : `stabil`;

    await logActivity({
      type: "PRICE_UPDATE",
      title: `Sinkronisasi Harga: ${existing.productName}`,
      description: `${data.updatedBy || "Staf Purchasing"} memperbarui harga "${existing.productName}" dari vendor "${existing.vendorName}" dari Rp ${oldPrice.toLocaleString("id-ID")} menjadi Rp ${newPrice.toLocaleString("id-ID")} / ${existing.unit} (${statusNote}). Alasan: ${data.reason || "Pembaruan harga vendor"}.`,
      actor: data.updatedBy || "Staf Purchasing",
      actorRole: "Staf Pengadaan",
      referenceId: existing.vendorName,
      metadata: {
        productName: existing.productName,
        vendorName: existing.vendorName,
        oldPrice,
        newPrice,
        diff,
        percentDiff,
        reason: data.reason,
      },
    });

    return {
      success: true,
      message: `✓ Harga "${existing.productName}" dari "${existing.vendorName}" berhasil disinkronkan (${statusNote}) menjadi Rp ${newPrice.toLocaleString("id-ID")}/${existing.unit}!`,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deleteVendorPrice(id: string) {
  try {
    const item = await prisma.vendorPriceItem.delete({ where: { id } });
    // Update best price for remaining
    const allForProduct = await prisma.vendorPriceItem.findMany({
      where: { productName: item.productName },
      orderBy: { unitPrice: "asc" },
    });
    if (allForProduct.length > 0) {
      const minPrice = allForProduct[0].unitPrice;
      for (const it of allForProduct) {
        await prisma.vendorPriceItem.update({
          where: { id: it.id },
          data: { isBestPrice: it.unitPrice === minPrice },
        });
      }
    }
    revalidatePath("/");
    return { success: true, message: "Penawaran harga berhasil dihapus." };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// 7. Pengaturan & Koneksi Telegram Staf Purchasing (Berdasarkan ID Card)
export async function updateStaffTelegram(
  idCard: string,
  data: {
    telegramChatId?: string;
    telegramUsername?: string;
    telegramEnabled: boolean;
  }
) {
  try {
    const auth = await assertSelfStaffSession(idCard);
    if (!auth.ok) {
      return { success: false, requiresRelogin: auth.requiresRelogin, error: auth.error };
    }
    const cleanId = auth.session.idCard;
    const staff = await prisma.purchasingStaff.findUnique({
      where: { id: auth.session.userId },
    });
    if (!staff) {
      return { success: false, error: `Staf Purchasing dengan ID Card "${idCard}" tidak ditemukan.` };
    }

    const updated = await prisma.purchasingStaff.update({
      where: { id: staff.id },
      data: {
        telegramChatId: data.telegramChatId ? data.telegramChatId.trim() : null,
        telegramUsername: data.telegramUsername ? data.telegramUsername.trim().replace(/^@/, "") : null,
        telegramEnabled: Boolean(data.telegramEnabled),
      },
    });

    await logActivity({
      type: "TELEGRAM_UPDATE",
      title: `Pengaturan Telegram ID Card ${cleanId}`,
      description: `${staff.name} (${cleanId}) memperbarui status notifikasi Telegram: ${
        data.telegramEnabled ? "Aktif" : "Nonaktif"
      } (Chat ID: ${data.telegramChatId || "-"}).`,
      actor: staff.name,
      actorRole: staff.position || "Staf Purchasing",
      referenceId: cleanId,
    });

    revalidatePath("/");
    return {
      success: true,
      message: "Pengaturan Telegram ID Card Anda berhasil disimpan!",
      staff: {
        id: updated.id,
        idCard: updated.idCard,
        name: updated.name,
        position: updated.position,
        role: updated.role,
        telegramChatId: updated.telegramChatId,
        telegramUsername: updated.telegramUsername,
        telegramEnabled: updated.telegramEnabled,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 8. Pengaturan Global Bot Telegram Perusahaan (BotFather Token & Username)
export async function updateTelegramBotConfig(data: {
  botToken?: string;
  botUsername?: string;
  isActive: boolean;
}) {
  try {
    const cleanToken = data.botToken ? data.botToken.trim() : null;
    const cleanUsername = data.botUsername ? data.botUsername.trim().replace(/^@/, "") : null;

    await prisma.telegramConfig.upsert({
      where: { id: "default" },
      update: {
        botToken: cleanToken,
        botUsername: cleanUsername,
        isActive: data.isActive,
      },
      create: {
        id: "default",
        botToken: cleanToken,
        botUsername: cleanUsername,
        isActive: data.isActive,
      },
    });

    revalidatePath("/");
    return { success: true, message: "Konfigurasi Bot Telegram Perusahaan berhasil diperbarui!" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 9. Uji Coba Pengiriman Pesan Notifikasi Telegram ke Staf Terhubung
export async function testStaffTelegramNotification(
  idCard: string,
  customChatId?: string
) {
  try {
    const cleanId = idCard.trim().toUpperCase();
    const staff = await prisma.purchasingStaff.findFirst({
      where: { idCard: cleanId },
    });
    const name = staff ? staff.name : `Staf (${cleanId})`;
    const chatId = customChatId ? customChatId.trim() : staff?.telegramChatId;

    if (!chatId) {
      return {
        success: false,
        error: "Nomor Chat ID Telegram belum diisi. Masukkan Chat ID Telegram Anda terlebih dahulu.",
      };
    }

    const result = await sendTelegramTestMessage(
      chatId,
      name,
      cleanId,
      "Sistem Purchasing & Pengadaan"
    );
    return result;
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 10. Pengaturan & Verifikasi Koneksi 9Router AI Gateway (Purchasing)
export async function saveNineRouterConfig(data: {
  baseUrl: string;
  apiKey?: string;
  clearApiKey?: boolean;
  defaultModel?: string;
  isEnabled: boolean;
  notes?: string;
}) {
  try {
    const existing = await getRawNineRouterConfig();
    const { apiV1Url } = normalizeNineRouterUrls(data.baseUrl);
    const sameEndpoint = apiV1Url === normalizeNineRouterUrls(existing.baseUrl).apiV1Url;
    const nextApiKey = data.clearApiKey
      ? null
      : data.apiKey?.trim()
        ? data.apiKey.trim()
        : sameEndpoint
          ? existing.apiKey
          : null;

    await prisma.nineRouterConfig.upsert({
      where: { id: "default" },
      update: {
        baseUrl: apiV1Url,
        apiKey: nextApiKey,
        defaultModel: data.defaultModel?.trim() || null,
        isEnabled: Boolean(data.isEnabled),
        notes: data.notes?.trim() || null,
      },
      create: {
        id: "default",
        baseUrl: apiV1Url,
        apiKey: nextApiKey,
        defaultModel: data.defaultModel?.trim() || null,
        isEnabled: Boolean(data.isEnabled),
        notes: data.notes?.trim() || null,
      },
    });

    await logActivity({
      type: "AI_ROUTER_CONFIG",
      title: "Konfigurasi 9Router AI Gateway",
      description: `Endpoint AI diperbarui ke ${apiV1Url} (Status integrasi: ${
        data.isEnabled ? "Aktif" : "Nonaktif"
      }, Default Model: ${data.defaultModel?.trim() || "Auto"}).`,
      actor: "Tim Purchasing",
      actorRole: "Admin Pengadaan",
      referenceId: "9Router",
    });

    const config = await getNineRouterConfigDto();
    revalidatePath("/");
    return {
      success: true,
      message: "Konfigurasi AI Gateway berhasil disimpan!",
      config,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testNineRouterConnection(data?: {
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  model?: string;
  verifyUsable?: boolean;
}) {
  return await checkNineRouterHealth({
    baseUrl: data?.baseUrl,
    apiKey: data?.apiKey,
    clearApiKey: data?.clearApiKey,
    model: data?.model,
    persistStatus: !data?.baseUrl && !data?.clearApiKey,
    verifyUsable: data?.verifyUsable !== false,
  });
}

// 11. Personalisasi & Restore Default Dashboard Khusus Per Staf (Berdasarkan ID Card)
export async function saveStaffDashboardPrefs(idCard: string, prefsJson: string) {
  try {
    const auth = await assertSelfStaffSession(idCard);
    if (!auth.ok) {
      return { success: false, requiresRelogin: auth.requiresRelogin, error: auth.error };
    }
    const cleanId = auth.session.idCard;
    const staff = await prisma.purchasingStaff.findUnique({ where: { id: auth.session.userId } });
    if (!staff) {
      return { success: false, error: `Staf dengan ID Card "${cleanId}" tidak ditemukan.` };
    }
    const normalized = parsePurchasingPrefs(prefsJson);
    const serialized = JSON.stringify(normalized);
    await prisma.purchasingStaff.update({
      where: { id: staff.id },
      data: { dashboardConfigJson: serialized },
    });
    revalidatePath("/");
    return {
      success: true,
      message: `Tampilan dashboard khusus akun ${staff.name} (${cleanId}) berhasil disimpan!`,
      dashboardConfigJson: serialized,
      prefs: normalized,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menyimpan preferensi tampilan.",
    };
  }
}

export async function resetStaffDashboardPrefs(idCard: string) {
  try {
    const auth = await assertSelfStaffSession(idCard);
    if (!auth.ok) {
      return { success: false, requiresRelogin: auth.requiresRelogin, error: auth.error };
    }
    const cleanId = auth.session.idCard;
    const staff = await prisma.purchasingStaff.findUnique({ where: { id: auth.session.userId } });
    if (!staff) {
      return { success: false, error: `Staf dengan ID Card "${cleanId}" tidak ditemukan.` };
    }
    await prisma.purchasingStaff.update({
      where: { id: staff.id },
      data: { dashboardConfigJson: null },
    });
    revalidatePath("/");
    return {
      success: true,
      message: `Tampilan dashboard akun ${staff.name} (${cleanId}) telah dikembalikan ke Default!`,
      dashboardConfigJson: null,
      prefs: DEFAULT_PURCHASING_PREFS,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal mengembalikan tampilan default.",
    };
  }
}
