import { prisma } from "./prisma";

export interface TelegramConfigData {
  botToken: string | null;
  botUsername: string | null;
  isActive: boolean;
}

/**
 * Mengambil konfigurasi Bot Telegram (dari database atau fallback ke environment variable)
 */
export async function getTelegramConfig(): Promise<TelegramConfigData> {
  try {
    const config = await prisma.telegramConfig.findUnique({
      where: { id: "default" },
    });

    const botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN || null;
    const botUsername = config?.botUsername || process.env.TELEGRAM_BOT_USERNAME || null;
    const isActive = config ? config.isActive : true;

    return { botToken, botUsername, isActive };
  } catch {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN || null,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || null,
      isActive: true,
    };
  }
}

/**
 * Mengirim pesan teks ke Telegram Chat ID spesifik
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<{ success: boolean; error?: string; data?: any }> {
  if (!chatId || !chatId.trim()) {
    return { success: false, error: "Nomor Telegram Chat ID kosong." };
  }

  const { botToken, isActive } = await getTelegramConfig();

  if (!isActive) {
    return { success: false, error: "Notifikasi Telegram sedang dinonaktifkan." };
  }

  if (!botToken || !botToken.trim()) {
    return {
      success: false,
      error: "Bot Token Telegram belum dikonfigurasi. Silakan masukkan Bot Token dari @BotFather di menu Pengaturan Telegram.",
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        text,
        parse_mode: parseMode,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      return {
        success: false,
        error: result.description || "Gagal mengirim pesan melalui Telegram Bot API.",
      };
    }

    return { success: true, data: result.result };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Gagal menghubungi server Telegram.",
    };
  }
}

/**
 * Mengirim pesan foto ke Telegram Chat ID spesifik
 */
export async function sendTelegramPhoto(
  chatId: string,
  photoUrl: string,
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  if (!chatId || !chatId.trim() || !photoUrl) {
    return { success: false, error: "Chat ID atau URL Foto tidak valid." };
  }

  const { botToken, isActive } = await getTelegramConfig();
  if (!isActive || !botToken) return { success: false, error: "Telegram Bot tidak aktif." };

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId.trim(),
        photo: photoUrl,
        caption: caption || "",
        parse_mode: "Markdown",
      }),
    });

    const result = await response.json();
    return { success: result.ok, error: result.description };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengirim notifikasi ke semua staf Purchasing yang memiliki Telegram aktif
 */
export async function broadcastToPurchasingStaff(message: string): Promise<number> {
  try {
    const activeStaff = await prisma.purchasingStaff.findMany({
      where: {
        telegramEnabled: true,
        telegramChatId: { not: null },
      },
    });

    let sentCount = 0;
    for (const staff of activeStaff) {
      if (staff.telegramChatId) {
        const res = await sendTelegramMessage(staff.telegramChatId, message);
        if (res.success) sentCount++;
      }
    }
    return sentCount;
  } catch {
    return 0;
  }
}

/**
 * Mengirim pesan uji coba koneksi Telegram
 */
export async function sendTelegramTestMessage(
  chatId: string,
  staffName: string,
  idCard: string,
  systemName = "Sistem Purchasing"
): Promise<{ success: boolean; error?: string }> {
  const timeStr = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const message =
    `🚀 *KONEKSI TELEGRAM BERHASIL TERHUBUNG!*\n\n` +
    `Halo *${staffName}*!\n` +
    `ID Card Anda (*${idCard}*) telah sukses dikaitkan dengan ${systemName}.\n\n` +
    `📋 *Detail Sesi:*\n` +
    `• Sistem: ${systemName}\n` +
    `• Nomor ID: \`${idCard}\`\n` +
    `• Chat ID: \`${chatId}\`\n` +
    `• Waktu Terhubung: ${timeStr} WIB\n\n` +
    `🔔 *Notifikasi yang akan Anda terima di sini:*\n` +
    `✓ Pemberitahuan penerbitan Purchase Order (PO) baru\n` +
    `✓ Konfirmasi kedatangan & bukti foto barang tiba dari Gudang\n` +
    `✓ Pemberitahuan pengajuan restock (PR) dari Kepala Gudang\n` +
    `✓ Konfirmasi pencatatan kasir & pelunasan pembayaran PO\n\n` +
    `_Pesan otomatis dikirim oleh Antigravity System Bot_`;

  return await sendTelegramMessage(chatId, message);
}
