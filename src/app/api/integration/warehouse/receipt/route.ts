import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastToPurchasingStaff } from "@/lib/telegram";

// POST /api/integration/warehouse/receipt
// Endpoint ini dipanggil secara real-time oleh Sistem Gudang (http://localhost:3000)
// ketika barang fisik hasil pembelian PO tiba di gudang dan diterima oleh staf gudang.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      poNumber,
      status,
      receivedAt,
      receivedBy,
      warehouseName,
      notes,
      imageUrl,
      imageTimestamp,
    } = body;

    if (!poNumber) {
      return NextResponse.json(
        { success: false, error: "poNumber wajib disertakan" },
        { status: 400 }
      );
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { poNumber },
    });

    if (!po) {
      return NextResponse.json(
        { success: false, error: `Purchase Order ${poNumber} tidak ditemukan di sistem Purchasing.` },
        { status: 404 }
      );
    }

    const receiveDate = receivedAt ? new Date(receivedAt) : new Date();

    // 1. Update status PO di sistem Purchasing menjadi RECEIVED beserta bukti fisik dari gudang
    const updatedPo = await prisma.purchaseOrder.update({
      where: { poNumber },
      data: {
        status: status || "RECEIVED",
        receivedAt: receiveDate,
        receivedBy: receivedBy || "Staf Penerimaan Gudang",
        receivedWarehouse: warehouseName || "Gudang Utama",
        receiptNotes: notes || `Barang telah diterima di ${warehouseName || "Gudang"} oleh ${receivedBy || "Staf Gudang"}`,
        receiptPhotoUrl: imageUrl || null,
        receiptTimestamp: imageTimestamp || null,
      },
    });

    // 2. Buat notifikasi instan untuk tim Purchasing
    await prisma.deliveryNotification.create({
      data: {
        poNumber,
        supplierName: po.supplierName,
        warehouseName: warehouseName || "Gudang Utama",
        receivedBy: receivedBy || "Staf Penerimaan Gudang",
        receivedAt: receiveDate,
        notes: notes || "Barang tiba lengkap dan fisik telah diverifikasi oleh staf gudang.",
        photoUrl: imageUrl || null,
        timestamp: imageTimestamp || null,
        read: false,
      },
    });

    // 3. Kirim notifikasi instan Telegram ke seluruh staf Purchasing yang mengaktifkan Telegram
    try {
      const receiptMsg =
        `🚚 *BARANG TELAH TIBA DI GUDANG!*\n\n` +
        `No. PO: *${poNumber}*\n` +
        `Vendor: *${po.supplierName}*\n` +
        `Lokasi Gudang: *${warehouseName || "Gudang Utama"}*\n` +
        `Diterima Oleh: *${receivedBy || "Staf Gudang"}*\n` +
        `Waktu Kedatangan: ${receiveDate.toLocaleString("id-ID")}\n` +
        `Catatan: ${notes || "Barang fisik lengkap dan diverifikasi"}\n\n` +
        (imageUrl
          ? `📸 *Bukti Foto Penerimaan Tersedia*\nStaf gudang telah melampirkan foto verifikasi fisik barang. Cek dashboard Purchasing untuk melihat detailnya.`
          : `_Status PO ${poNumber} otomatis diperbarui menjadi RECEIVED._`);
      await broadcastToPurchasingStaff(receiptMsg);
    } catch (err) {
      console.warn("Telegram webhook receipt broadcast failed:", err);
    }

    revalidatePath("/");

    return NextResponse.json({
      success: true,
      message: `Data kedatangan barang untuk PO ${poNumber} berhasil diterima dan disinkronkan ke Purchasing!`,
      data: {
        poNumber: updatedPo.poNumber,
        status: updatedPo.status,
        receivedAt: updatedPo.receivedAt,
        receivedBy: updatedPo.receivedBy,
        receivedWarehouse: updatedPo.receivedWarehouse,
        receiptNotes: updatedPo.receiptNotes,
      },
    });
  } catch (error: any) {
    console.error("Gagal memproses kedatangan barang dari Gudang:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses webhook penerimaan gudang" },
      { status: 500 }
    );
  }
}

// GET /api/integration/warehouse/receipt
// Ambil riwayat notifikasi kedatangan barang dari gudang
export async function GET() {
  try {
    const notifications = await prisma.deliveryNotification.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ success: true, data: notifications });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
