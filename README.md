# Sistem Purchasing & Pengadaan Terintegrasi

Platform pengadaan barang, penerbitan Purchase Order (PO), direktori vendor/supplier, dan integrasi kedatangan barang dengan sistem Gudang serta penyesuaian regulasi PPN resmi Indonesia (DJP / Kemenkeu RI).

## Fitur Utama

- **Login ID Card Perusahaan**: Masuk menggunakan ID Card resmi karyawan Purchasing (contoh: `PUR-001`, `PUR-002`).
- **Penerbitan PO Cepat**:
  - Auto-detect informasi perusahaan/retail (No. HP, WhatsApp, Alamat fisik, Google Maps).
  - Terhubung dengan katalog barang stok sistem Gudang.
- **Koneksi Gudang Real-time**:
  - Konfirmasi kedatangan barang langsung dari staf gudang lengkap dengan bukti foto & timestamp.
  - Penanganan permintaan restock (PR - Purchase Requisition) dari gudang.
- **Sinkronisasi Regulasi Pajak Indonesia (DJP / Kemenkeu RI)**:
  - Tarif PPN Standar 12% (UU HPP No. 7/2021).
  - Tarif PPN Efektif 11% (PMK No. 131/2024).
  - Fasilitas Bebas PPN (0%).
  - Auto-update dan sinkronisasi live dengan portal DJP (`pajak.go.id`).
- **Filter & Pencarian PO Multi-Kriteria**:
  - Live search nomor PO, nama vendor, nama barang, pembuat PO.
  - Filter status kedatangan gudang (`Menunggu Gudang`, `Diterima Gudang`).
  - Filter vendor & sorting harga / tanggal.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database & ORM**: SQLite & Prisma ORM
- **UI & Styling**: Tailwind CSS, Lucide React
- **Package Manager**: pnpm

## Cara Menjalankan

1. Salin `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```
2. Pasang dependensi:
   ```bash
   pnpm install
   ```
3. Sinkronisasi database:
   ```bash
   pnpm prisma db push
   ```
4. Jalankan server pengembangan:
   ```bash
   pnpm dev
   ```
   Aplikasi akan berjalan di `http://localhost:3001`.
