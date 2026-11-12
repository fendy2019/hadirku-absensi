# HadirKu — Aplikasi Absensi Karyawan & HRIS Cloud

Aplikasi Web Absensi Karyawan modern yang responsif untuk **Smartphone & Desktop** dengan arsitektur **Hybrid (Cloud Supabase PostgreSQL + Mode Demo Instan)**.

---

## ✨ Fitur Utama

1. **Absen Masuk & Pulang Real-Time**
   - Jam digital real-time dengan deteksi otomatis status **Hadir Tepat Waktu** vs **Terlambat** (berdasarkan jam masuk kantor & toleransi keterlambatan).
   - Kalkulasi otomatis **Durasi Kerja (Jam)** dan **Lembur (Menit)** saat karyawan melakukan Absen Pulang.
2. **Verifikasi Kamera Selfie (Watermark Otomatis) & Lokasi GPS (Peta Interaktif)**
   - Ambil foto selfie langsung dari webcam/kamera HP lengkap dengan watermark waktu, nama, NIP, dan koordinat GPS.
   - Peta interaktif **Leaflet** yang menampilkan titik kantor pusat, radius lingkaran *geofencing*, posisi karyawan, dan jarak dalam meter (*Haversine formula*).
   - Tersedia tombol **Simulasi GPS di Kantor / Luar Kantor** & **Simulasi Foto Instan** agar mudah diuji pada perangkat PC tanpa GPS/kamera.
3. **Scan QR Code & Kartu ID Digital Karyawan**
   - Pemindai kamera QR Code (`html5-qrcode`) untuk absensi tanpa sentuh.
   - Generator **Kartu ID Digital Karyawan** ber-QR Code (siap cetak) dan **QR Code Gate Resepsionis Kantor**.
4. **Pengajuan Izin, Sakit, Cuti Tahunan & Lembur + Approval HRD**
   - Formulir pengajuan lengkap dengan pemotongan otomatis sisa kuota cuti tahunan dan pencatatan otomatis ke log absensi ketika disetujui oleh Admin HRD.
5. **Dashboard Rekapitulasi Admin & Export Laporan**
   - Filter berdasarkan tanggal, departemen, status kehadiran, dan pencarian nama/NIP.
   - Export 1-klik ke **Excel (`.xls`)**, **CSV (`.csv`)**, dan **Cetak PDF**.
6. **Integrasi Cloud Supabase (PostgreSQL)**
   - Dilengkapi file skema database [`supabase/schema.sql`](./supabase/schema.sql) dan panel pengaturan di dalam aplikasi untuk menghubungkan `Project URL` dan `Anon Key` Supabase serta tombol **Upload & Sinkronkan Data Lokal ke Supabase**.

---

## 🚀 Cara Menjalankan Aplikasi

### Cara 1: Jalankan dengan Server Node.js (Direkomendasikan agar Kamera & GPS berjalan optimal)
```bash
cd C:\Users\62813\.gemini\antigravity\scratch\aplikasi-absensi
node server.js
```
Lalu buka **`http://localhost:3000`** di browser Anda.

### Cara 2: Buka Langsung di Browser
Buka file [`index.html`](./index.html) langsung menggunakan Google Chrome / Edge / Firefox.

---

## ☁️ Cara Menghubungkan ke Cloud Supabase

1. Buat proyek baru di [Supabase Dashboard](https://supabase.com/dashboard).
2. Buka menu **SQL Editor** di Supabase, lalu salin dan jalankan seluruh isi file [`supabase/schema.sql`](./supabase/schema.sql).
3. Salin **Project URL** dan **Anon Public Key** dari menu **Project Settings → API** di Supabase.
4. Pada aplikasi **HadirKu**, buka menu **Karyawan & Cloud Supabase**, masukkan URL dan Anon Key tersebut, lalu klik **Hubungkan**.
5. Klik **⬆️ Upload & Sinkronkan Data Lokal ke Supabase** jika Anda ingin mengunggah data simulasi/lokal ke database Supabase Anda.
