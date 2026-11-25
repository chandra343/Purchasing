# 🏢 Sistem Purchasing & Pengadaan Terintegrasi

Platform web modern untuk pengadaan barang industri & retail, penerbitan Purchase Order (PO), komparasi harga bahan baku multi-vendor, pembaruan harga vendor tersinkronisasi, pencatatan kasir/pembayaran, serta integrasi kedatangan barang fisik dengan sistem Gudang dan penyesuaian regulasi PPN resmi Indonesia (DJP / Kemenkeu RI).

---

## 🌟 Fitur Utama

### 1. 🧭 Navigasi Rapi & Simpel (4 Menu Utama)
- **Ringkasan (Dashboard)**: Tinjauan eksekutif total belanja (*spending*), status pembayaran (*unpaid vs paid*), notifikasi kedatangan barang baru dari gudang, serta tombol aksi cepat pengadaan.
- **Pesanan PO & PR**: Hub terpadu pelacakan Purchase Order (PO) dan evaluasi Permintaan Pembelian dari Gudang (PR / Requisition) lengkap dengan filter instan (Menunggu Gudang, Sudah Diterima, Belum Lunas).
- **Vendor & Harga Bahan Baku**: Pusat data satu pintu mencakup Komparasi Harga Supplier, Formulir Update Harga Mandiri, Direktori Kontak WhatsApp Vendor, dan Pantauan Stok Gudang.
- **Riwayat Aktivitas & Audit Trail**: Jejak audit log kronologis seluruh penyesuaian harga, penerbitan PO, pencatatan kasir, verifikasi kedatangan barang gudang, dan regulasi pajak.

### 2. 🏷️ Fitur Mandiri: Update & Sinkronisasi Harga Vendor
- **Pembaruan Harga Fleksibel**: Staf purchasing dapat langsung memperbarui harga penawaran ketika supplier menaikkan atau menurunkan harga bahan baku.
- **Kalkulator Fluktuasi Otomatis**: Menghitung selisih nominal (Rp) dan persentase perubahan (%) harga secara *real-time* disertai indikator kenaikan (merah) atau penurunan harga (hijau).
- **Catatan & Jejak Revisi**: Mencatat alasan revisi harga (misal: "Penyesuaian kurs dolar", "Diskon akhir tahun") yang langsung tersimpan dalam riwayat fluktuasi vendor.
- **Auto-Sync ke Katalog Belanja**: Harga baru otomatis langsung menjadi acuan saat membuat Purchase Order baru.

### 3. 🔍 Katalog & Komparasi Multi-Vendor
- Komparasi penawaran harga bahan baku sejenis antar-vendor (misal: Biji Plastik, Pelat Baja, Kabel NYY, Isopropyl Alcohol, Karton Box).
- Pencarian cerdas, filter kategori bahan, dan *sorting* penawaran harga termurah (*best price*) atau waktu pengiriman (*fastest lead time*).
- Integrasi tombol negosiasi langsung ke **WhatsApp Vendor Resmi**.

### 4. 📦 Integrasi Gudang Real-Time (Dua Arah)
- Sinkronisasi otomatis ke sistem **Gudang (WMS)** di port `3000`.
- Konfirmasi penerimaan barang fisik langsung diverifikasi staf gudang lengkap dengan **bukti foto pengiriman** dan catatan kondisi barang.
- Konversi permintaan restock (*Purchase Requisition*) dari kepala gudang langsung menjadi Purchase Order (PO) resmi hanya dengan 1 klik.

### 5. 💰 Pencatatan Kasir & Pembayaran Multi-Tahap
- Pelacakan status pembayaran faktur/tagihan PO (**Belum Lunas / Lunas**).
- Pencatatan metode pembayaran (Transfer Bank BCA/Mandiri/BRI, Tempo/Term of Payment 30/60 hari, Tunai).
- Riwayat penerbitan tanda terima pembayaran kasir.

### 6. ⚖️ Regulasi Pajak Resmi Indonesia (DJP / Kemenkeu RI)
- Perhitungan PPN otomatis sesuai aturan perpajakan nasional:
  - **Tarif Standar PPN 12%** (UU Harmonisasi Peraturan Perpajakan No. 7/2021).
  - **Tarif Efektif PPN 11%** (PMK No. 131/2024).
  - **Fasilitas Bebas PPN (0%)** untuk bahan baku tertentu/kawasan berikat.
- Sinkronisasi status regulasi live dengan portal Direktorat Jenderal Pajak RI (`pajak.go.id`).

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Language**: TypeScript & React 19
- **Database & ORM**: SQLite & Prisma ORM
- **Styling**: Tailwind CSS & Lucide Icons
- **Integrasi**: REST API Real-time antar-port (Port 3001 Purchasing <-> Port 3000 Gudang)
- **Package Manager**: pnpm

---

## 🚀 Panduan Menjalankan

### 1. Salin File Konfigurasi Environment
```bash
cp .env.example .env
```

### 2. Pasang Dependensi
```bash
pnpm install
```

### 3. Sinkronisasi Database Prisma
```bash
pnpm prisma generate
pnpm prisma db push
```

### 4. Jalankan Server Development
```bash
pnpm dev
```
Aplikasi Purchasing siap diakses di: **[http://localhost:3001](http://localhost:3001)**

---

## 📱 Integrasi Notifikasi Telegram ID Card

Setiap staf pengadaan dapat menghubungkan nomor ID Card mereka (misal: `PUR-001`, `PUR-002`, `PUR-003`) ke akun Telegram masing-masing untuk menerima notifikasi real-time:
- 📦 **Penerbitan PO Baru**: Notifikasi instan saat PO diterbitkan beserta nilai transaksi, termin bayar, dan vendor.
- 🚚 **Barang Tiba di Gudang**: Alert otomatis lengkap dengan konfirmasi penerimaan fisik dan bukti foto dari tim Gudang.
- 📋 **Pengajuan Restock (PR)**: Notifikasi permintaan restock dari Kepala Gudang.
- 💳 **Pencatatan Pembayaran**: Konfirmasi status pelunasan pembayaran kasir/purchasing.

### Cara Menghubungkan ID Card ke Telegram:
1. Buka dashboard Purchasing di `http://localhost:3001` dan masuk dengan nomor ID Card Anda.
2. Klik tombol **📱 Hubungkan Telegram** di bilah atas (atau melalui menu profil akun).
3. Buka Telegram dan cari bot `@userinfobot` untuk mendapatkan **Chat ID** Anda.
4. Masukkan Chat ID pada modal integrasi, aktifkan centang notifikasi, lalu klik **Simpan Pengaturan ID Card**.
5. Gunakan tombol **Kirim Pesan Uji Coba** untuk memverifikasi bot dapat mengirimkan pesan ke akun Anda.

---

## 🔗 Ekosistem Terintegrasi

| Aplikasi | Port | Repository GitHub | Deskripsi |
| :--- | :--- | :--- | :--- |
| **Purchasing Web** | `3001` | [chandra343/Purchasing](https://github.com/chandra343/Purchasing) | Platform Pengadaan, Komparasi Vendor & PO |
| **Gudang Web (WMS)** | `3000` | [chandra343/Gudang](https://github.com/chandra343/Gudang) | Manajemen Stok Fisik & Penerimaan Barang |
| **9Router AI Gateway** | `20128` | [`9router/`](./9router) (fork `Azhar457/9router`) | Pusat AI Gateway & Bridge OpenAI-Compatible |

---

## 🤖 Integrasi 9Router AI Gateway (`9router/`)

Project ini menyertakan **9Router AI Gateway** di subfolder [`9router/`](./9router) dan endpoint bridge siap pakai agar terhubung dengan Purchasing, Gudang, maupun project lain di masa mendatang:

### Menjalankan 9Router AI Gateway:
```bash
pnpm router:install
pnpm router:dev
```
Dashboard 9Router berjalan di: **`http://localhost:20128`** (API OpenAI-compatible di **`http://localhost:20128/v1`**).

### Endpoint Bridge AI Purchasing (CORS-Enabled):
- `GET http://localhost:3001/api/ai/status` — Cek status koneksi & kesehatan 9Router.
- `GET http://localhost:3001/api/ai/models` — Daftar model AI yang tersedia di 9Router.
- `POST http://localhost:3001/api/ai/chat` — Endpoint inferensi/chat AI terhubung langsung ke 9Router.
