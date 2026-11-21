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

  return {
    success: true,
    user: {
      id: staff.id,
      idCard: staff.idCard,
      name: staff.name,
      position: staff.position,
      role: staff.role,
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
  ]);

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
    vendorPrices: activeVendorPrices,
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
    },
  };
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

  revalidatePath("/");
  return po;
}

// 4. Sinkronisasi Langsung dari Portal Pajak Indonesia (pajak.go.id / Kemenkeu)
export async function syncTaxFromPajakIndonesia() {
  const result = await syncOfficialIndonesianTax();
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
}) {
  try {
    const cleanProductName = data.productName.trim();
    const cleanVendorName = data.vendorName.trim();

    if (!cleanProductName || !cleanVendorName || data.unitPrice <= 0) {
      return { success: false, error: "Nama produk, nama vendor, dan harga satuan valid wajib diisi." };
    }

    if (data.id) {
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
          unitPrice: Number(data.unitPrice),
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

    revalidatePath("/");
    return { success: true, message: `Penawaran harga untuk "${cleanProductName}" dari "${cleanVendorName}" berhasil disimpan!` };
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
