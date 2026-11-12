-- ============================================================================
-- HADIRKU - SISTEM ABSENSI KARYAWAN PINTAR
-- Skema Database PostgreSQL untuk Proyek Supabase: hadirku-absensi (pzozwdgehovnigugfpuy)
-- ============================================================================

-- 1. TABEL PENGATURAN KANTOR (OFFICE SETTINGS)
CREATE TABLE IF NOT EXISTS public.office_settings (
    id INT PRIMARY KEY DEFAULT 1,
    company_name TEXT NOT NULL DEFAULT 'PT Nusantara Digital Utama',
    work_start_time TIME NOT NULL DEFAULT '08:00:00',
    late_tolerance_minutes INT NOT NULL DEFAULT 15,
    work_end_time TIME NOT NULL DEFAULT '17:00:00',
    office_lat DOUBLE PRECISION NOT NULL DEFAULT -6.2088,
    office_lng DOUBLE PRECISION NOT NULL DEFAULT 106.8456,
    max_radius_meters INT NOT NULL DEFAULT 150,
    enforce_geofence BOOLEAN NOT NULL DEFAULT false,
    require_selfie BOOLEAN NOT NULL DEFAULT true,
    office_qr_secret TEXT NOT NULL DEFAULT 'HADIRKU-GATE-2026-HQ',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABEL KARYAWAN (EMPLOYEES)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    nip TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE,
    password TEXT NOT NULL DEFAULT 'karyawan123',
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department TEXT NOT NULL,
    position TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
    phone TEXT,
    leave_quota INT NOT NULL DEFAULT 12,
    avatar_color TEXT DEFAULT 'indigo',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABEL LOG ABSENSI HARIAN (ATTENDANCE LOGS)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    department TEXT NOT NULL,
    date DATE NOT NULL,
    clock_in TEXT,
    clock_out TEXT,
    status TEXT NOT NULL CHECK (status IN ('Hadir', 'Terlambat', 'Izin', 'Sakit', 'Cuti', 'Dinas Luar')),
    late_minutes INT NOT NULL DEFAULT 0,
    overtime_minutes INT NOT NULL DEFAULT 0,
    work_hours NUMERIC(5,2) NOT NULL DEFAULT 0,
    method TEXT NOT NULL DEFAULT 'Selfie + GPS' CHECK (method IN ('Selfie + GPS', 'QR Code', 'Admin / Manual', 'Form Izin/Cuti')),
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    distance_meters INT,
    location_label TEXT,
    photo_in TEXT,
    photo_out TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- 4. TABEL PENGAJUAN IZIN, SAKIT, CUTI & LEMBUR (LEAVE & OVERTIME REQUESTS)
CREATE TABLE IF NOT EXISTS public.leave_overtime_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name TEXT NOT NULL,
    department TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Izin', 'Sakit', 'Cuti', 'Dinas Luar', 'Lembur')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    overtime_hours NUMERIC(4,1) DEFAULT 0,
    reason TEXT NOT NULL,
    attachment_name TEXT,
    status TEXT NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Disetujui', 'Ditolak')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR FOREIGN KEYS & QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_attendance_logs_employee_id ON public.attendance_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_date ON public.attendance_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON public.leave_overtime_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_overtime_requests(status);

-- EXPOSE TO DATA API ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.office_settings TO anon, authenticated;
GRANT ALL ON TABLE public.employees TO anon, authenticated;
GRANT ALL ON TABLE public.attendance_logs TO anon, authenticated;
GRANT ALL ON TABLE public.leave_overtime_requests TO anon, authenticated;

-- ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_overtime_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow client access office_settings"
    ON public.office_settings FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow client access employees"
    ON public.employees FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow client access attendance_logs"
    ON public.attendance_logs FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow client access leave_overtime_requests"
    ON public.leave_overtime_requests FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
