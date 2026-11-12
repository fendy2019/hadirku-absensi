/**
 * ============================================================================
 * HADIRKU - HYBRID SUPABASE & LOCAL STORAGE DATA SERVICE
 * ============================================================================
 * Mendukung:
 * 1. Mode Cloud Supabase (PostgreSQL real-time via @supabase/supabase-js v2)
 * 2. Mode Demo Instan (LocalStorage dengan seed data realistis)
 * 3. Sinkronisasi 1-Klik dari Mode Demo ke Database Supabase
 */

const STORAGE_KEYS = {
    STATE: 'hadirku_app_state_v1',
    SUPABASE_CONFIG: 'hadirku_supabase_config_v1',
    ACTIVE_USER: 'hadirku_active_user_v1'
};

// Helper tanggal YYYY-MM-DD sesuai zona waktu lokal
function getLocalDateStr(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Generator SVG Avatar Selfie Simulasi untuk data awal
function createPlaceholderPhoto(name, timeStr, badgeText = 'MASUK') {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const bg = badgeText === 'MASUK' ? '#312e81' : '#065f46';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
        <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="${bg}"/>
                <stop offset="100%" stop-color="#0f172a"/>
            </linearGradient>
        </defs>
        <rect width="320" height="240" fill="url(#g)"/>
        <circle cx="160" cy="95" r="42" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="2"/>
        <text x="160" y="105" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="26" font-weight="bold">${initials}</text>
        <rect x="10" y="178" width="300" height="52" rx="8" fill="rgba(0,0,0,0.65)"/>
        <text x="22" y="198" fill="#38bdf8" font-family="monospace" font-size="11" font-weight="bold">VERIFIED ${badgeText} • ${timeStr}</text>
        <text x="22" y="216" fill="#e2e8f0" font-family="sans-serif" font-size="11">${name} • GPS Kantor Pusat</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Data Awal (Seed Data)
function getInitialSeedState() {
    const today = getLocalDateStr(0);
    const yesterday = getLocalDateStr(-1);
    const twoDaysAgo = getLocalDateStr(-2);

    return {
        officeSettings: {
            id: 1,
            company_name: 'PT Nusantara Digital Utama',
            work_start_time: '08:00',
            late_tolerance_minutes: 15,
            work_end_time: '17:00',
            office_lat: -6.2088,
            office_lng: 106.8456,
            max_radius_meters: 150,
            enforce_geofence: false,
            require_selfie: true,
            office_qr_secret: 'HADIRKU-GATE-2026-HQ'
        },
        employees: [
            {
                id: 'EMP-001',
                nip: '20260101',
                name: 'Budi Santoso',
                email: 'budi.santoso@nusantaradigital.id',
                department: 'Engineering',
                position: 'Senior Frontend Engineer',
                role: 'employee',
                phone: '0812-3456-7801',
                leave_quota: 10,
                avatar_color: 'indigo',
                active: true
            },
            {
                id: 'EMP-002',
                nip: '20260102',
                name: 'Siti Rahmawati',
                email: 'siti.rahma@nusantaradigital.id',
                department: 'Human Resources',
                position: 'HR Manager (Admin)',
                role: 'admin',
                phone: '0812-3456-7802',
                leave_quota: 12,
                avatar_color: 'emerald',
                active: true
            },
            {
                id: 'EMP-003',
                nip: '20260103',
                name: 'Andi Pratama',
                email: 'andi.pratama@nusantaradigital.id',
                department: 'Product & Design',
                position: 'UI/UX Designer',
                role: 'employee',
                phone: '0812-3456-7803',
                leave_quota: 9,
                avatar_color: 'violet',
                active: true
            },
            {
                id: 'EMP-004',
                nip: '20260104',
                name: 'Dewi Lestari',
                email: 'dewi.lestari@nusantaradigital.id',
                department: 'Finance',
                position: 'Finance Specialist',
                role: 'employee',
                phone: '0812-3456-7804',
                leave_quota: 11,
                avatar_color: 'amber',
                active: true
            },
            {
                id: 'EMP-005',
                nip: '20260105',
                name: 'Rizky Ramadhan',
                email: 'rizky.ramadhan@nusantaradigital.id',
                department: 'Engineering',
                position: 'Backend Developer',
                role: 'employee',
                phone: '0812-3456-7805',
                leave_quota: 8,
                avatar_color: 'rose',
                active: true
            }
        ],
        attendanceLogs: [
            // Hari Ini (beberapa karyawan sudah absen)
            {
                id: `ATT-${today}-EMP002`,
                employee_id: 'EMP-002',
                employee_name: 'Siti Rahmawati',
                department: 'Human Resources',
                date: today,
                clock_in: '07:48:12',
                clock_out: null,
                status: 'Hadir',
                late_minutes: 0,
                overtime_minutes: 0,
                work_hours: 0,
                method: 'Selfie + GPS',
                lat: -6.2087,
                lng: 106.8455,
                distance_meters: 18,
                location_label: 'Kantor Pusat (18m)',
                photo_in: createPlaceholderPhoto('Siti Rahmawati', '07:48:12', 'MASUK'),
                photo_out: null,
                notes: 'Hadir tepat waktu'
            },
            {
                id: `ATT-${today}-EMP003`,
                employee_id: 'EMP-003',
                employee_name: 'Andi Pratama',
                department: 'Product & Design',
                date: today,
                clock_in: '08:27:40',
                clock_out: null,
                status: 'Terlambat',
                late_minutes: 27,
                overtime_minutes: 0,
                work_hours: 0,
                method: 'QR Code',
                lat: -6.2089,
                lng: 106.8457,
                distance_meters: 24,
                location_label: 'Gate QR Lobby Utama (24m)',
                photo_in: createPlaceholderPhoto('Andi Pratama', '08:27:40', 'MASUK'),
                photo_out: null,
                notes: 'Macet di jalan tol dalam kota'
            },
            // Kemarin
            {
                id: `ATT-${yesterday}-EMP001`,
                employee_id: 'EMP-001',
                employee_name: 'Budi Santoso',
                department: 'Engineering',
                date: yesterday,
                clock_in: '07:52:10',
                clock_out: '18:35:00',
                status: 'Hadir',
                late_minutes: 0,
                overtime_minutes: 95,
                work_hours: 10.71,
                method: 'Selfie + GPS',
                lat: -6.2088,
                lng: 106.8456,
                distance_meters: 12,
                location_label: 'Kantor Pusat (12m)',
                photo_in: createPlaceholderPhoto('Budi Santoso', '07:52:10', 'MASUK'),
                photo_out: createPlaceholderPhoto('Budi Santoso', '18:35:00', 'PULANG'),
                notes: 'Rilis sprint modul pembayaran'
            },
            {
                id: `ATT-${yesterday}-EMP002`,
                employee_id: 'EMP-002',
                employee_name: 'Siti Rahmawati',
                department: 'Human Resources',
                date: yesterday,
                clock_in: '07:55:04',
                clock_out: '17:08:22',
                status: 'Hadir',
                late_minutes: 0,
                overtime_minutes: 8,
                work_hours: 9.22,
                method: 'QR Code',
                lat: -6.2088,
                lng: 106.8456,
                distance_meters: 15,
                location_label: 'Kantor Pusat (15m)',
                photo_in: createPlaceholderPhoto('Siti Rahmawati', '07:55:04', 'MASUK'),
                photo_out: createPlaceholderPhoto('Siti Rahmawati', '17:08:22', 'PULANG'),
                notes: ''
            },
            {
                id: `ATT-${yesterday}-EMP004`,
                employee_id: 'EMP-004',
                employee_name: 'Dewi Lestari',
                department: 'Finance',
                date: yesterday,
                clock_in: '08:04:19',
                clock_out: '17:15:00',
                status: 'Hadir',
                late_minutes: 0,
                overtime_minutes: 15,
                work_hours: 9.18,
                method: 'Selfie + GPS',
                lat: -6.2089,
                lng: 106.8455,
                distance_meters: 21,
                location_label: 'Kantor Pusat (21m)',
                photo_in: createPlaceholderPhoto('Dewi Lestari', '08:04:19', 'MASUK'),
                photo_out: createPlaceholderPhoto('Dewi Lestari', '17:15:00', 'PULANG'),
                notes: 'Toleransi < 15 menit'
            },
            // 2 Hari Lalu
            {
                id: `ATT-${twoDaysAgo}-EMP001`,
                employee_id: 'EMP-001',
                employee_name: 'Budi Santoso',
                department: 'Engineering',
                date: twoDaysAgo,
                clock_in: '07:58:00',
                clock_out: '17:10:00',
                status: 'Hadir',
                late_minutes: 0,
                overtime_minutes: 10,
                work_hours: 9.2,
                method: 'Selfie + GPS',
                lat: -6.2088,
                lng: 106.8456,
                distance_meters: 10,
                location_label: 'Kantor Pusat (10m)',
                photo_in: createPlaceholderPhoto('Budi Santoso', '07:58:00', 'MASUK'),
                photo_out: createPlaceholderPhoto('Budi Santoso', '17:10:00', 'PULANG'),
                notes: ''
            }
        ],
        leaveRequests: [
            {
                id: 'REQ-2026-001',
                employee_id: 'EMP-005',
                employee_name: 'Rizky Ramadhan',
                department: 'Engineering',
                type: 'Sakit',
                start_date: today,
                end_date: today,
                overtime_hours: 0,
                reason: 'Demam tinggi & pemeriksaan dokter di RS Mitra Keluarga',
                attachment_name: 'Surat_Dokter_Rizky.pdf',
                status: 'Menunggu',
                reviewed_by: null,
                reviewed_at: null,
                created_at: new Date(Date.now() - 3600 * 1000 * 3).toISOString()
            },
            {
                id: 'REQ-2026-002',
                employee_id: 'EMP-001',
                employee_name: 'Budi Santoso',
                department: 'Engineering',
                type: 'Lembur',
                start_date: yesterday,
                end_date: yesterday,
                overtime_hours: 1.5,
                reason: 'Deployment hotfix API gateway & monitoring trafik malam',
                attachment_name: 'Tiket_Deploy_JIRA-402.png',
                status: 'Disetujui',
                reviewed_by: 'Siti Rahmawati',
                reviewed_at: new Date(Date.now() - 3600 * 1000 * 14).toISOString(),
                created_at: new Date(Date.now() - 3600 * 1000 * 20).toISOString()
            },
            {
                id: 'REQ-2026-003',
                employee_id: 'EMP-004',
                employee_name: 'Dewi Lestari',
                department: 'Finance',
                type: 'Cuti',
                start_date: getLocalDateStr(3),
                end_date: getLocalDateStr(4),
                overtime_hours: 0,
                reason: 'Acara pernikahan keluarga inti di Bandung',
                attachment_name: '',
                status: 'Menunggu',
                reviewed_by: null,
                reviewed_at: null,
                created_at: new Date(Date.now() - 3600 * 1000 * 5).toISOString()
            }
        ]
    };
}

class HadirkuDataService {
    constructor() {
        this.supabaseClient = null;
        this.isCloudConnected = false;
        this.cloudConfig = this.loadCloudConfig();
        this.state = this.loadLocalState();
        this.initSupabaseClient();
    }

    loadCloudConfig() {
        const defaultConfig = {
            url: 'https://pzozwdgehovnigugfpuy.supabase.co',
            anonKey: 'sb_publishable_P9cTOgfbUXRXl-cLwDG8wA_gaz3tZbf',
            enabled: true
        };
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.url && parsed.anonKey) {
                    return parsed;
                }
            }
        } catch (err) {
            console.warn('Gagal memuat konfigurasi Supabase:', err);
        }
        return defaultConfig;
    }

    saveCloudConfig(url, anonKey, enabled = true) {
        this.cloudConfig = {
            url: (url || '').trim(),
            anonKey: (anonKey || '').trim(),
            enabled: Boolean(enabled && url && anonKey)
        };
        localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(this.cloudConfig));
        this.initSupabaseClient();
    }

    initSupabaseClient() {
        this.supabaseClient = null;
        this.isCloudConnected = false;

        if (
            this.cloudConfig.enabled &&
            this.cloudConfig.url &&
            this.cloudConfig.anonKey &&
            window.supabase &&
            typeof window.supabase.createClient === 'function'
        ) {
            try {
                this.supabaseClient = window.supabase.createClient(
                    this.cloudConfig.url,
                    this.cloudConfig.anonKey
                );
                this.isCloudConnected = true;
            } catch (err) {
                console.error('Inisialisasi Supabase gagal:', err);
                this.isCloudConnected = false;
            }
        }
    }

    loadLocalState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.STATE);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.employees && parsed.attendanceLogs) {
                    return parsed;
                }
            }
        } catch (err) {
            console.warn('Gagal membaca state lokal, menggunakan seed data:', err);
        }
        const seed = getInitialSeedState();
        this.saveLocalState(seed);
        return seed;
    }

    saveLocalState(newState = this.state) {
        this.state = newState;
        try {
            localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(this.state));
        } catch (err) {
            console.error('Gagal menyimpan state ke LocalStorage:', err);
        }
    }

    resetDemoData() {
        const seed = getInitialSeedState();
        this.saveLocalState(seed);
        return seed;
    }

    // Ambil data terbaru dari Supabase jika terhubung
    async fetchFromCloud() {
        if (!this.isCloudConnected || !this.supabaseClient) {
            return { ok: false, message: 'Mode Demo Aktif (Supabase belum dikonfigurasi)' };
        }

        try {
            const [settingsRes, empRes, attRes, reqRes] = await Promise.all([
                this.supabaseClient.from('office_settings').select('*').eq('id', 1).maybeSingle(),
                this.supabaseClient.from('employees').select('*').order('nip', { ascending: true }),
                this.supabaseClient.from('attendance_logs').select('*').order('date', { ascending: false }),
                this.supabaseClient.from('leave_overtime_requests').select('*').order('created_at', { ascending: false })
            ]);

            if (settingsRes.error) throw settingsRes.error;
            if (empRes.error) throw empRes.error;
            if (attRes.error) throw attRes.error;
            if (reqRes.error) throw reqRes.error;

            if (settingsRes.data) {
                this.state.officeSettings = {
                    ...this.state.officeSettings,
                    ...settingsRes.data,
                    work_start_time: String(settingsRes.data.work_start_time).slice(0, 5),
                    work_end_time: String(settingsRes.data.work_end_time).slice(0, 5)
                };
            }
            if (empRes.data && empRes.data.length > 0) {
                this.state.employees = empRes.data;
            }
            if (attRes.data) {
                this.state.attendanceLogs = attRes.data;
            }
            if (reqRes.data) {
                this.state.leaveRequests = reqRes.data;
            }

            this.saveLocalState();
            return { ok: true, message: 'Data berhasil disinkronkan dari Cloud Supabase!' };
        } catch (err) {
            console.error('Supabase fetch error:', err);
            return {
                ok: false,
                message: `Gagal memuat dari Supabase: ${err.message || 'Pastikan tabel sudah dibuat dengan schema.sql'}`
            };
        }
    }

    // Push seluruh data lokal ke Supabase (Sinkronisasi 1-Klik)
    async syncLocalToCloud() {
        if (!this.isCloudConnected || !this.supabaseClient) {
            return { ok: false, message: 'Masukkan URL & Anon Key Supabase terlebih dahulu.' };
        }

        try {
            const s = this.state.officeSettings;
            const { error: errSettings } = await this.supabaseClient
                .from('office_settings')
                .upsert({
                    id: 1,
                    company_name: s.company_name,
                    work_start_time: s.work_start_time,
                    late_tolerance_minutes: Number(s.late_tolerance_minutes),
                    work_end_time: s.work_end_time,
                    office_lat: Number(s.office_lat),
                    office_lng: Number(s.office_lng),
                    max_radius_meters: Number(s.max_radius_meters),
                    enforce_geofence: Boolean(s.enforce_geofence),
                    require_selfie: Boolean(s.require_selfie),
                    office_qr_secret: s.office_qr_secret
                });
            if (errSettings) throw errSettings;

            if (this.state.employees.length > 0) {
                const { error: errEmp } = await this.supabaseClient
                    .from('employees')
                    .upsert(this.state.employees);
                if (errEmp) throw errEmp;
            }

            if (this.state.attendanceLogs.length > 0) {
                const { error: errAtt } = await this.supabaseClient
                    .from('attendance_logs')
                    .upsert(this.state.attendanceLogs);
                if (errAtt) throw errAtt;
            }

            if (this.state.leaveRequests.length > 0) {
                const { error: errReq } = await this.supabaseClient
                    .from('leave_overtime_requests')
                    .upsert(this.state.leaveRequests);
                if (errReq) throw errReq;
            }

            return { ok: true, message: 'Seluruh data lokal berhasil di-upload ke Supabase!' };
        } catch (err) {
            console.error('Gagal sinkronisasi ke Supabase:', err);
            return {
                ok: false,
                message: `Error Supabase: ${err.message || 'Pastikan Anda sudah menjalankan supabase/schema.sql di SQL Editor.'}`
            };
        }
    }

    // CRUD Operations (Hybrid: Update Local + Push to Supabase if connected)
    async upsertAttendance(logEntry) {
        const idx = this.state.attendanceLogs.findIndex(
            item => item.id === logEntry.id || (item.employee_id === logEntry.employee_id && item.date === logEntry.date)
        );
        if (idx >= 0) {
            this.state.attendanceLogs[idx] = { ...this.state.attendanceLogs[idx], ...logEntry };
        } else {
            this.state.attendanceLogs.unshift(logEntry);
        }
        this.saveLocalState();

        if (this.isCloudConnected && this.supabaseClient) {
            const { error } = await this.supabaseClient.from('attendance_logs').upsert(logEntry);
            if (error) console.warn('Supabase upsert attendance warning:', error.message);
        }
        return logEntry;
    }

    async addLeaveRequest(reqEntry) {
        this.state.leaveRequests.unshift(reqEntry);
        this.saveLocalState();

        if (this.isCloudConnected && this.supabaseClient) {
            const { error } = await this.supabaseClient.from('leave_overtime_requests').upsert(reqEntry);
            if (error) console.warn('Supabase insert request warning:', error.message);
        }
        return reqEntry;
    }

    async updateLeaveRequestStatus(reqId, newStatus, reviewerName) {
        const req = this.state.leaveRequests.find(r => r.id === reqId);
        if (!req) return null;

        req.status = newStatus;
        req.reviewed_by = reviewerName;
        req.reviewed_at = new Date().toISOString();

        // Jika disetujui dan bertipe Izin/Sakit/Cuti/Dinas Luar, catat otomatis ke log absensi
        if (newStatus === 'Disetujui' && ['Izin', 'Sakit', 'Cuti', 'Dinas Luar'].includes(req.type)) {
            const existingIdx = this.state.attendanceLogs.findIndex(
                a => a.employee_id === req.employee_id && a.date === req.start_date
            );
            const autoLog = {
                id: `ATT-${req.start_date}-${req.employee_id}`,
                employee_id: req.employee_id,
                employee_name: req.employee_name,
                department: req.department,
                date: req.start_date,
                clock_in: '-',
                clock_out: '-',
                status: req.type,
                late_minutes: 0,
                overtime_minutes: 0,
                work_hours: 0,
                method: 'Form Izin/Cuti',
                lat: null,
                lng: null,
                distance_meters: 0,
                location_label: `Disetujui oleh ${reviewerName}`,
                photo_in: null,
                photo_out: null,
                notes: req.reason
            };
            if (existingIdx >= 0) {
                this.state.attendanceLogs[existingIdx] = autoLog;
            } else {
                this.state.attendanceLogs.unshift(autoLog);
            }

            // Kurangi kuota cuti jika tipe Cuti
            if (req.type === 'Cuti') {
                const emp = this.state.employees.find(e => e.id === req.employee_id);
                if (emp && emp.leave_quota > 0) {
                    emp.leave_quota = Math.max(0, emp.leave_quota - 1);
                }
            }
        }

        this.saveLocalState();

        if (this.isCloudConnected && this.supabaseClient) {
            await this.supabaseClient
                .from('leave_overtime_requests')
                .update({
                    status: req.status,
                    reviewed_by: req.reviewed_by,
                    reviewed_at: req.reviewed_at
                })
                .eq('id', reqId);
        }
        return req;
    }

    async upsertEmployee(empData) {
        const idx = this.state.employees.findIndex(e => e.id === empData.id);
        if (idx >= 0) {
            this.state.employees[idx] = { ...this.state.employees[idx], ...empData };
        } else {
            this.state.employees.push(empData);
        }
        this.saveLocalState();

        if (this.isCloudConnected && this.supabaseClient) {
            const { error } = await this.supabaseClient.from('employees').upsert(empData);
            if (error) console.warn('Supabase upsert employee warning:', error.message);
        }
        return empData;
    }

    async deleteEmployee(empId) {
        this.state.employees = this.state.employees.filter(e => e.id !== empId);
        this.saveLocalState();

        if (this.isCloudConnected && this.supabaseClient) {
            await this.supabaseClient.from('employees').delete().eq('id', empId);
        }
    }

    async updateOfficeSettings(newSettings) {
        this.state.officeSettings = {
            ...this.state.officeSettings,
            ...newSettings
        };
        this.saveLocalState();

        if (this.isCloudConnected && this.supabaseClient) {
            await this.supabaseClient.from('office_settings').upsert({
                id: 1,
                ...this.state.officeSettings
            });
        }
        return this.state.officeSettings;
    }
}

window.HadirkuService = new HadirkuDataService();
window.getLocalDateStr = getLocalDateStr;
window.createPlaceholderPhoto = createPlaceholderPhoto;
