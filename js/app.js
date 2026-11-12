/**
 * ============================================================================
 * HADIRKU - MAIN APPLICATION CONTROLLER
 * ============================================================================
 */

const AUTH_SESSION_KEY = 'hadirku_auth_session_v1';

const App = {
    isAuthenticated: false,
    activeTab: 'attendance', // 'attendance' | 'qr' | 'leave' | 'admin-recap' | 'settings'
    currentEmployeeId: 'EMP-001',
    gpsState: {
        lat: -6.20875,
        lng: 106.84558,
        accuracy: 14,
        distanceMeters: 12,
        mode: 'office_sim', // 'real' | 'office_sim' | 'remote_sim'
        label: 'Kantor Pusat Jakarta (12m)'
    },
    cameraStream: null,
    capturedPhotoDataUrl: null,
    leafletMap: null,
    officeMarker: null,
    officeCircle: null,
    userMarker: null,
    html5QrScanner: null,
    isQrScannerRunning: false,

    init() {
        this.startRealtimeClock();
        this.recalculateGpsDistance();
        this.checkAuthSession();
        this.renderEmployeeSelector();
        this.updateCloudBadge();
        this.switchTab('attendance');

        // Jika Supabase sudah dikonfigurasi, tarik data terbaru di background
        if (window.HadirkuService.isCloudConnected) {
            window.HadirkuService.fetchFromCloud().then(res => {
                if (res.ok) {
                    this.renderAllActiveViews();
                    if (this.isAuthenticated) {
                        this.showToast('Terhubung ke Cloud Supabase', 'success');
                    }
                }
            });
        }
    },

    // ========================================================================
    // AUTENTIKASI LOGIN, LOGOUT & FITUR EYEFISH (SHOW/HIDE PASSWORD)
    // ========================================================================
    checkAuthSession() {
        const savedEmpId =
            sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
        const foundEmp =
            savedEmpId && window.HadirkuService.state.employees.find(e => e.id === savedEmpId);

        const loginScreen = document.getElementById('auth-login-screen');
        if (foundEmp) {
            this.isAuthenticated = true;
            this.currentEmployeeId = foundEmp.id;
            if (loginScreen) loginScreen.classList.add('hidden');
        } else {
            this.isAuthenticated = false;
            if (loginScreen) loginScreen.classList.remove('hidden');
        }
    },

    togglePasswordVisibility(inputId, btnId, stateLabelId = null) {
        const inputEl = document.getElementById(inputId);
        const btnEl = document.getElementById(btnId);
        const labelEl = stateLabelId ? document.getElementById(stateLabelId) : null;
        if (!inputEl) return;

        const isCurrentlyPassword = inputEl.type === 'password';
        inputEl.type = isCurrentlyPassword ? 'text' : 'password';

        if (btnEl) {
            const closedIcon = btnEl.querySelector('.eye-closed-icon');
            const openIcon = btnEl.querySelector('.eye-open-icon');
            if (closedIcon && openIcon) {
                if (isCurrentlyPassword) {
                    closedIcon.classList.add('hidden');
                    openIcon.classList.remove('hidden');
                    openIcon.classList.add('flex');
                } else {
                    openIcon.classList.add('hidden');
                    openIcon.classList.remove('flex');
                    closedIcon.classList.remove('hidden');
                }
            }
        }

        if (labelEl) {
            labelEl.textContent = isCurrentlyPassword ? 'Terlihat (Eyefish Aktif)' : 'Tersembunyi';
            labelEl.className = isCurrentlyPassword
                ? 'text-[11px] font-bold text-indigo-600'
                : 'text-[11px] font-medium text-slate-400';
        }
    },

    fillLoginCredentials(username, password) {
        const userEl = document.getElementById('login-username-input');
        const passEl = document.getElementById('login-password-input');
        const errBox = document.getElementById('login-error-alert');
        if (userEl) userEl.value = username;
        if (passEl) passEl.value = password;
        if (errBox) errBox.classList.add('hidden');
    },

    handleLoginSubmit(e) {
        e.preventDefault();
        const usernameVal = (document.getElementById('login-username-input')?.value || '').trim().toLowerCase();
        const passwordVal = document.getElementById('login-password-input')?.value || '';
        const rememberMe = document.getElementById('login-remember-me')?.checked;
        const errBox = document.getElementById('login-error-alert');
        const errMsg = document.getElementById('login-error-message');

        const employees = window.HadirkuService.state.employees;
        const matchedEmp = employees.find(emp => {
            const u = (emp.username || emp.name.split(' ')[0] || '').toLowerCase();
            const nip = (emp.nip || '').toLowerCase();
            const email = (emp.email || '').toLowerCase();
            const expectedPass = emp.password || (emp.role === 'admin' ? 'admin123' : 'karyawan123');
            return (u === usernameVal || nip === usernameVal || email === usernameVal) && expectedPass === passwordVal;
        });

        if (!matchedEmp) {
            if (errMsg) {
                errMsg.textContent = 'Username/NIP atau Password tidak sesuai! Gunakan akun demo di bawah jika lupa.';
            }
            if (errBox) errBox.classList.remove('hidden');
            return;
        }

        if (errBox) errBox.classList.add('hidden');
        this.isAuthenticated = true;
        this.currentEmployeeId = matchedEmp.id;
        localStorage.setItem('hadirku_active_user_v1', matchedEmp.id);
        sessionStorage.setItem(AUTH_SESSION_KEY, matchedEmp.id);
        if (rememberMe) {
            localStorage.setItem(AUTH_SESSION_KEY, matchedEmp.id);
        } else {
            localStorage.removeItem(AUTH_SESSION_KEY);
        }

        const loginScreen = document.getElementById('auth-login-screen');
        if (loginScreen) loginScreen.classList.add('hidden');

        this.renderAllActiveViews();
        setTimeout(() => this.initOrUpdateMap(), 120);
        this.showToast(`Selamat datang, ${matchedEmp.name} (${matchedEmp.role === 'admin' ? 'Admin HRD' : matchedEmp.department})!`, 'success');
    },

    handleLogout() {
        this.stopCamera();
        if (this.isQrScannerRunning) {
            this.stopQrScanner();
        }
        this.isAuthenticated = false;
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        localStorage.removeItem(AUTH_SESSION_KEY);

        // Reset form login & kembalikan password ke mode tersembunyi
        const passInput = document.getElementById('login-password-input');
        const toggleBtn = document.getElementById('btn-toggle-login-password');
        const stateLabel = document.getElementById('login-password-state-label');
        if (passInput) {
            passInput.value = '';
            passInput.type = 'password';
        }
        if (toggleBtn) {
            const closedIcon = toggleBtn.querySelector('.eye-closed-icon');
            const openIcon = toggleBtn.querySelector('.eye-open-icon');
            if (closedIcon) closedIcon.classList.remove('hidden');
            if (openIcon) {
                openIcon.classList.add('hidden');
                openIcon.classList.remove('flex');
            }
        }
        if (stateLabel) {
            stateLabel.textContent = 'Tersembunyi';
            stateLabel.className = 'text-[11px] font-medium text-slate-400';
        }

        const loginScreen = document.getElementById('auth-login-screen');
        if (loginScreen) loginScreen.classList.remove('hidden');

        this.showToast('Anda telah berhasil keluar (Log Out).', 'info');
    },

    get currentEmployee() {
        const emps = window.HadirkuService.state.employees;
        return emps.find(e => e.id === this.currentEmployeeId) || emps[0];
    },

    get officeSettings() {
        return window.HadirkuService.state.officeSettings;
    },

    // ========================================================================
    // JAM REAL-TIME & SINKRONISASI UI
    // ========================================================================
    startRealtimeClock() {
        const updateClock = () => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(/\./g, ':');

            const dateStr = now.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            const clockEl = document.getElementById('live-clock-display');
            const dateEl = document.getElementById('live-date-display');
            const topClockEl = document.getElementById('topbar-clock');

            if (clockEl) clockEl.textContent = timeStr;
            if (dateEl) dateEl.textContent = dateStr;
            if (topClockEl) topClockEl.textContent = timeStr;
        };
        updateClock();
        setInterval(updateClock, 1000);
    },

    switchEmployee(empId) {
        this.currentEmployeeId = empId;
        localStorage.setItem('hadirku_active_user_v1', empId);
        this.capturedPhotoDataUrl = null;
        this.renderEmployeeSelector();
        this.renderAllActiveViews();
        this.showToast(`Beralih ke profil: ${this.currentEmployee.name}`, 'info');
    },

    renderEmployeeSelector() {
        const select = document.getElementById('employee-switcher');
        const roleBadge = document.getElementById('active-role-badge');
        const userDeptEl = document.getElementById('active-user-dept');

        if (!select) return;
        const emps = window.HadirkuService.state.employees;
        select.innerHTML = emps
            .map(
                emp =>
                    `<option value="${emp.id}" ${emp.id === this.currentEmployeeId ? 'selected' : ''}>
                        ${emp.name} (${emp.nip}) — ${emp.role === 'admin' ? 'Admin HRD' : emp.department}
                    </option>`
            )
            .join('');

        const curr = this.currentEmployee;
        if (roleBadge) {
            if (curr.role === 'admin') {
                roleBadge.className = 'px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';
                roleBadge.textContent = 'Admin HRD';
            } else {
                roleBadge.className = 'px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200';
                roleBadge.textContent = 'Karyawan';
            }
        }
        if (userDeptEl) {
            userDeptEl.textContent = `${curr.position} • ${curr.department}`;
        }
    },

    updateCloudBadge() {
        const badge = document.getElementById('cloud-status-badge');
        if (!badge) return;
        if (window.HadirkuService.isCloudConnected) {
            badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition';
            badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span><span>Supabase Cloud Aktif</span>`;
        } else {
            badge.className = 'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 cursor-pointer hover:bg-amber-100 transition';
            badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Mode Demo Lokal (Klik untuk Cloud)</span>`;
        }
    },

    switchTab(tabName) {
        this.activeTab = tabName;

        // Matikan scanner QR jika pindah dari tab QR
        if (tabName !== 'qr' && this.isQrScannerRunning) {
            this.stopQrScanner();
        }

        // Update state tombol navigasi desktop & mobile
        document.querySelectorAll('[data-nav-tab]').forEach(btn => {
            const isTarget = btn.getAttribute('data-nav-tab') === tabName;
            if (btn.classList.contains('mobile-nav-btn')) {
                btn.className = isTarget
                    ? 'mobile-nav-btn flex flex-col items-center justify-center py-2 px-3 text-indigo-600 font-semibold text-xs'
                    : 'mobile-nav-btn flex flex-col items-center justify-center py-2 px-3 text-slate-500 hover:text-slate-800 text-xs';
            } else {
                btn.className = isTarget
                    ? 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-sm shadow-indigo-200 transition'
                    : 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition';
            }
        });

        // Tampilkan section yang sesuai
        document.querySelectorAll('.tab-section').forEach(sec => {
            sec.classList.add('hidden');
        });
        const activeSec = document.getElementById(`tab-${tabName}`);
        if (activeSec) activeSec.classList.remove('hidden');

        this.renderAllActiveViews();

        if (tabName === 'attendance') {
            setTimeout(() => this.initOrUpdateMap(), 120);
        } else if (tabName === 'qr') {
            setTimeout(() => this.renderQrCodes(), 80);
        }

        if (window.lucide) window.lucide.createIcons();
    },

    renderAllActiveViews() {
        this.renderEmployeeSelector();
        this.updateCloudBadge();
        this.renderAttendanceTab();
        this.renderLeaveTab();
        this.renderAdminRecapTab();
        this.renderSettingsTab();
        if (this.activeTab === 'qr') {
            this.renderQrCodes();
        }
        if (window.lucide) window.lucide.createIcons();
    },

    // ========================================================================
    // TAB 1: ABSEN MASUK & PULANG + KAMERA SELFIE + LOKASI GPS
    // ========================================================================
    calculateHaversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const toRad = deg => (deg * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    },

    recalculateGpsDistance() {
        const s = this.officeSettings;
        const dist = this.calculateHaversineMeters(
            this.gpsState.lat,
            this.gpsState.lng,
            Number(s.office_lat),
            Number(s.office_lng)
        );
        this.gpsState.distanceMeters = dist;
        if (dist <= Number(s.max_radius_meters)) {
            this.gpsState.label = `Dalam Radius Kantor (${dist}m)`;
        } else {
            this.gpsState.label = `Luar Radius Kantor (${dist}m)`;
        }
    },

    useSimulatedGps(mode) {
        const s = this.officeSettings;
        if (mode === 'office') {
            // Titik dekat kantor (sekitar 12-18 meter)
            this.gpsState.lat = Number(s.office_lat) + 0.00009;
            this.gpsState.lng = Number(s.office_lng) + 0.00008;
            this.gpsState.mode = 'office_sim';
            this.recalculateGpsDistance();
            this.showToast('Lokasi GPS diset ke area Kantor Pusat', 'success');
        } else if (mode === 'remote') {
            // Titik sekitar 1.8 km dari kantor
            this.gpsState.lat = Number(s.office_lat) + 0.014;
            this.gpsState.lng = Number(s.office_lng) + 0.011;
            this.gpsState.mode = 'remote_sim';
            this.recalculateGpsDistance();
            this.showToast('Lokasi GPS disimulasikan di Luar Kantor (WFH / Dinas Luar)', 'info');
        }
        this.initOrUpdateMap();
        this.renderAttendanceTab();
    },

    requestRealDeviceGps() {
        if (!navigator.geolocation) {
            this.showToast('Browser Anda tidak mendukung Geolocation API', 'error');
            return;
        }
        this.showToast('Mengambil titik GPS perangkat...', 'info');
        navigator.geolocation.getCurrentPosition(
            pos => {
                this.gpsState.lat = Number(pos.coords.latitude.toFixed(6));
                this.gpsState.lng = Number(pos.coords.longitude.toFixed(6));
                this.gpsState.accuracy = Math.round(pos.coords.accuracy || 15);
                this.gpsState.mode = 'real';
                this.recalculateGpsDistance();
                this.initOrUpdateMap();
                this.renderAttendanceTab();
                this.showToast(`GPS Akurat ditemukan (${this.gpsState.lat}, ${this.gpsState.lng})`, 'success');
            },
            err => {
                this.showToast(`Gagal akses GPS asli (${err.message}). Menggunakan simulasi GPS kantor.`, 'warning');
                this.useSimulatedGps('office');
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    },

    initOrUpdateMap() {
        const mapContainer = document.getElementById('gps-map');
        if (!mapContainer || !window.L) return;

        const s = this.officeSettings;
        const officeCoords = [Number(s.office_lat), Number(s.office_lng)];
        const userCoords = [this.gpsState.lat, this.gpsState.lng];

        if (!this.leafletMap) {
            this.leafletMap = L.map('gps-map', {
                zoomControl: true,
                attributionControl: false
            }).setView(userCoords, 17);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(this.leafletMap);
        }

        if (this.officeMarker) this.leafletMap.removeLayer(this.officeMarker);
        if (this.officeCircle) this.leafletMap.removeLayer(this.officeCircle);
        if (this.userMarker) this.leafletMap.removeLayer(this.userMarker);

        this.officeCircle = L.circle(officeCoords, {
            color: '#4f46e5',
            fillColor: '#6366f1',
            fillOpacity: 0.14,
            weight: 2,
            radius: Number(s.max_radius_meters)
        }).addTo(this.leafletMap);

        this.officeMarker = L.marker(officeCoords)
            .addTo(this.leafletMap)
            .bindPopup(`<b>${s.company_name}</b><br>Radius Geofence: ${s.max_radius_meters}m`);

        const inRadius = this.gpsState.distanceMeters <= Number(s.max_radius_meters);
        const dotColor = inRadius ? '#10b981' : '#f59e0b';
        const customUserIcon = L.divIcon({
            className: 'custom-user-pin',
            html: `<div style="width:18px;height:18px;border-radius:9999px;background:${dotColor};border:3px solid #fff;box-shadow:0 0 0 4px rgba(16,185,129,0.25);"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9]
        });

        this.userMarker = L.marker(userCoords, { icon: customUserIcon })
            .addTo(this.leafletMap)
            .bindPopup(`<b>Posisi Anda (${this.currentEmployee.name})</b><br>Jarak ke Kantor: ${this.gpsState.distanceMeters} meter`);

        this.leafletMap.invalidateSize();
        const group = new L.featureGroup([this.officeMarker, this.userMarker]);
        this.leafletMap.fitBounds(group.getBounds().pad(0.35), { maxZoom: 17 });
    },

    // Kamera Selfie WebRTC
    async startCamera() {
        const videoEl = document.getElementById('selfie-video');
        const placeholderEl = document.getElementById('camera-placeholder');
        const previewImg = document.getElementById('selfie-preview-img');

        this.capturedPhotoDataUrl = null;
        if (previewImg) previewImg.classList.add('hidden');

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.useSimulatedSelfie();
            return;
        }

        try {
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(t => t.stop());
            }
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false
            });
            if (videoEl) {
                videoEl.srcObject = this.cameraStream;
                videoEl.classList.remove('hidden');
            }
            if (placeholderEl) placeholderEl.classList.add('hidden');
            this.showToast('Kamera aktif. Silakan ambil foto selfie.', 'info');
        } catch (err) {
            console.warn('Kamera tidak tersedia atau izin ditolak, menggunakan simulasi foto:', err);
            this.useSimulatedSelfie();
        }
    },

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(t => t.stop());
            this.cameraStream = null;
        }
        const videoEl = document.getElementById('selfie-video');
        if (videoEl) videoEl.classList.add('hidden');
    },

    captureSelfie() {
        const videoEl = document.getElementById('selfie-video');
        const canvas = document.getElementById('selfie-canvas');
        const previewImg = document.getElementById('selfie-preview-img');
        const placeholderEl = document.getElementById('camera-placeholder');

        if (!this.cameraStream || !videoEl || videoEl.classList.contains('hidden')) {
            // Jika kamera belum nyala, gunakan generator selfie terverifikasi dengan watermark
            this.useSimulatedSelfie();
            return;
        }

        const ctx = canvas.getContext('2d');
        canvas.width = 480;
        canvas.height = 360;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

        // Tambahkan watermark waktu, nama & koordinat GPS
        const nowStr = new Date().toLocaleString('id-ID');
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(0, canvas.height - 64, canvas.width, 64);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(`HADIRKU VERIFIED • ${nowStr}`, 14, canvas.height - 38);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '12px sans-serif';
        ctx.fillText(
            `${this.currentEmployee.name} (${this.currentEmployee.nip}) • GPS: ${this.gpsState.lat.toFixed(4)}, ${this.gpsState.lng.toFixed(4)} (${this.gpsState.distanceMeters}m)`,
            14,
            canvas.height - 16
        );

        this.capturedPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this.stopCamera();

        if (previewImg) {
            previewImg.src = this.capturedPhotoDataUrl;
            previewImg.classList.remove('hidden');
        }
        if (placeholderEl) placeholderEl.classList.add('hidden');
        this.showToast('Foto selfie berhasil diambil lengkap dengan watermark GPS!', 'success');
    },

    useSimulatedSelfie() {
        const nowTime = new Date().toLocaleTimeString('id-ID', { hour12: false }).replace(/\./g, ':');
        const todayLog = this.getTodayAttendanceForCurrentEmployee();
        const badge = todayLog && todayLog.clock_in && !todayLog.clock_out ? 'PULANG' : 'MASUK';

        this.capturedPhotoDataUrl = window.createPlaceholderPhoto(this.currentEmployee.name, nowTime, badge);
        this.stopCamera();

        const previewImg = document.getElementById('selfie-preview-img');
        const placeholderEl = document.getElementById('camera-placeholder');
        if (previewImg) {
            previewImg.src = this.capturedPhotoDataUrl;
            previewImg.classList.remove('hidden');
        }
        if (placeholderEl) placeholderEl.classList.add('hidden');
        this.showToast('Foto Selfie Digital Terverifikasi siap digunakan!', 'success');
    },

    getTodayAttendanceForCurrentEmployee() {
        const today = window.getLocalDateStr(0);
        return window.HadirkuService.state.attendanceLogs.find(
            log => log.employee_id === this.currentEmployeeId && log.date === today
        );
    },

    // Proses Absen Masuk / Absen Pulang
    async submitClockAction(actionType, methodOverride = 'Selfie + GPS') {
        const emp = this.currentEmployee;
        const s = this.officeSettings;
        const today = window.getLocalDateStr(0);
        const now = new Date();
        const timeStr = now
            .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
            .replace(/\./g, ':');

        // Cek geofencing jika diaktifkan
        if (s.enforce_geofence && this.gpsState.distanceMeters > Number(s.max_radius_meters)) {
            this.showToast(
                `Gagal Absen: Anda berada ${this.gpsState.distanceMeters}m dari kantor (Maksimal ${s.max_radius_meters}m). Klik "Simulasi GPS di Kantor" atau matikan Geofence Ketat.`,
                'error'
            );
            return;
        }

        // Pastikan ada foto selfie (jika wajib selfie & bukan QR)
        if (s.require_selfie && methodOverride === 'Selfie + GPS' && !this.capturedPhotoDataUrl) {
            this.useSimulatedSelfie();
        }

        const notesInput = document.getElementById('attendance-notes-input');
        const notesVal = notesInput ? notesInput.value.trim() : '';
        const existingLog = this.getTodayAttendanceForCurrentEmployee();

        if (actionType === 'in') {
            if (existingLog && existingLog.clock_in && existingLog.clock_in !== '-') {
                this.showToast(`Anda sudah melakukan Absen Masuk hari ini pada pukul ${existingLog.clock_in}.`, 'warning');
                return;
            }

            // Hitung keterlambatan berdasarkan jam masuk kantor + toleransi
            const [startH, startM] = String(s.work_start_time).split(':').map(Number);
            const scheduleMinutes = startH * 60 + startM;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const diffMinutes = currentMinutes - scheduleMinutes;
            const isLate = diffMinutes > Number(s.late_tolerance_minutes || 0);
            const lateMinutes = isLate ? Math.max(0, diffMinutes) : 0;

            const newLog = {
                id: `ATT-${today}-${emp.id}`,
                employee_id: emp.id,
                employee_name: emp.name,
                department: emp.department,
                date: today,
                clock_in: timeStr,
                clock_out: null,
                status: isLate ? 'Terlambat' : 'Hadir',
                late_minutes: lateMinutes,
                overtime_minutes: 0,
                work_hours: 0,
                method: methodOverride,
                lat: this.gpsState.lat,
                lng: this.gpsState.lng,
                distance_meters: this.gpsState.distanceMeters,
                location_label: this.gpsState.label,
                photo_in: this.capturedPhotoDataUrl || window.createPlaceholderPhoto(emp.name, timeStr, 'MASUK'),
                photo_out: null,
                notes: notesVal || (isLate ? `Terlambat ${lateMinutes} menit` : 'Hadir tepat waktu')
            };

            await window.HadirkuService.upsertAttendance(newLog);
            if (notesInput) notesInput.value = '';
            this.renderAllActiveViews();
            this.showToast(
                `Absen Masuk Berhasil (${timeStr}) — Status: ${newLog.status}`,
                isLate ? 'warning' : 'success'
            );
        } else if (actionType === 'out') {
            if (!existingLog || !existingLog.clock_in || existingLog.clock_in === '-') {
                this.showToast('Anda belum melakukan Absen Masuk hari ini!', 'error');
                return;
            }
            if (existingLog.clock_out) {
                this.showToast(`Anda sudah melakukan Absen Pulang pada pukul ${existingLog.clock_out}.`, 'warning');
                return;
            }

            // Hitung total jam kerja & lembur
            const [inH, inM] = existingLog.clock_in.split(':').map(Number);
            const [outEndH, outEndM] = String(s.work_end_time).split(':').map(Number);
            const inTotalMinutes = inH * 60 + inM;
            const nowTotalMinutes = now.getHours() * 60 + now.getMinutes();
            const scheduleEndMinutes = outEndH * 60 + outEndM;

            const workedMinutes = Math.max(1, nowTotalMinutes - inTotalMinutes);
            const workHours = Number((workedMinutes / 60).toFixed(2));
            const overtimeMinutes = Math.max(0, nowTotalMinutes - scheduleEndMinutes);

            const updatedLog = {
                ...existingLog,
                clock_out: timeStr,
                work_hours: workHours,
                overtime_minutes: overtimeMinutes,
                photo_out: this.capturedPhotoDataUrl || window.createPlaceholderPhoto(emp.name, timeStr, 'PULANG'),
                notes: notesVal ? `${existingLog.notes ? existingLog.notes + ' | ' : ''}${notesVal}` : existingLog.notes
            };

            await window.HadirkuService.upsertAttendance(updatedLog);
            if (notesInput) notesInput.value = '';
            this.renderAllActiveViews();
            this.showToast(
                `Absen Pulang Berhasil (${timeStr})! Durasi kerja: ${workHours} jam${overtimeMinutes > 0 ? ` (Lembur ${overtimeMinutes} mnt)` : ''}.`,
                'success'
            );
        }
    },

    renderAttendanceTab() {
        const s = this.officeSettings;
        const emp = this.currentEmployee;
        const todayLog = this.getTodayAttendanceForCurrentEmployee();

        // Update info jam kerja kantor
        const scheduleEl = document.getElementById('office-schedule-info');
        if (scheduleEl) {
            scheduleEl.textContent = `Jam Kerja: ${s.work_start_time} – ${s.work_end_time} WIB (Toleransi ${s.late_tolerance_minutes} mnt)`;
        }

        // Update badge status GPS
        const gpsBadge = document.getElementById('gps-distance-badge');
        const gpsCoordsText = document.getElementById('gps-coords-text');
        const inRadius = this.gpsState.distanceMeters <= Number(s.max_radius_meters);

        if (gpsBadge) {
            gpsBadge.className = inRadius
                ? 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800'
                : 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800';
            gpsBadge.innerHTML = `<span class="w-2 h-2 rounded-full ${inRadius ? 'bg-emerald-500' : 'bg-amber-500'}"></span>
                ${this.gpsState.label} (Maks ${s.max_radius_meters}m)`;
        }
        if (gpsCoordsText) {
            gpsCoordsText.textContent = `Koordinat: ${this.gpsState.lat.toFixed(5)}, ${this.gpsState.lng.toFixed(5)}`;
        }

        // Update kartu status absen hari ini
        const statusCardEl = document.getElementById('today-attendance-status-card');
        const btnIn = document.getElementById('btn-clock-in');
        const btnOut = document.getElementById('btn-clock-out');

        if (statusCardEl) {
            if (!todayLog) {
                statusCardEl.innerHTML = `
                    <div class="flex items-center justify-between p-4 rounded-2xl bg-slate-100 border border-slate-200">
                        <div>
                            <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Status Hari Ini (${emp.name})</p>
                            <p class="text-lg font-bold text-slate-800 mt-0.5">Belum Melakukan Absensi</p>
                            <p class="text-xs text-slate-500 mt-0.5">Silakan ambil foto selfie & klik tombol Absen Masuk</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">Belum Absen</span>
                    </div>
                `;
                if (btnIn) {
                    btnIn.disabled = false;
                    btnIn.className = 'btn-pulse-indigo flex-1 py-3.5 px-5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition cursor-pointer';
                }
                if (btnOut) {
                    btnOut.disabled = true;
                    btnOut.className = 'flex-1 py-3.5 px-5 rounded-xl font-bold text-slate-400 bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed';
                }
            } else {
                const isDoneOut = Boolean(todayLog.clock_out);
                const badgeColor =
                    todayLog.status === 'Hadir'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : todayLog.status === 'Terlambat'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-sky-100 text-sky-800 border-sky-200';

                statusCardEl.innerHTML = `
                    <div class="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                        <div class="flex items-center justify-between mb-3">
                            <div>
                                <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600">Rekaman Kehadiran Hari Ini</p>
                                <p class="text-base font-bold text-slate-900">${emp.name} (${emp.nip})</p>
                            </div>
                            <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}">${todayLog.status}</span>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-center bg-white p-3 rounded-xl border border-indigo-100/80">
                            <div>
                                <p class="text-[11px] text-slate-500 font-medium">Jam Masuk</p>
                                <p class="text-sm font-bold font-mono-clock text-emerald-600 mt-0.5">${todayLog.clock_in || '-'}</p>
                            </div>
                            <div class="border-x border-slate-100">
                                <p class="text-[11px] text-slate-500 font-medium">Jam Pulang</p>
                                <p class="text-sm font-bold font-mono-clock text-indigo-600 mt-0.5">${todayLog.clock_out || 'Belum Pulang'}</p>
                            </div>
                            <div>
                                <p class="text-[11px] text-slate-500 font-medium">Metode / Lembur</p>
                                <p class="text-xs font-semibold text-slate-700 mt-0.5">${todayLog.method} ${todayLog.overtime_minutes > 0 ? `(+${todayLog.overtime_minutes}m)` : ''}</p>
                            </div>
                        </div>
                    </div>
                `;

                if (btnIn) {
                    btnIn.disabled = true;
                    btnIn.className = 'flex-1 py-3.5 px-5 rounded-xl font-bold text-slate-400 bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed';
                }
                if (btnOut) {
                    if (!isDoneOut && todayLog.clock_in !== '-') {
                        btnOut.disabled = false;
                        btnOut.className = 'btn-pulse-indigo flex-1 py-3.5 px-5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-200 flex items-center justify-center gap-2 transition cursor-pointer';
                    } else {
                        btnOut.disabled = true;
                        btnOut.className = 'flex-1 py-3.5 px-5 rounded-xl font-bold text-slate-400 bg-slate-100 border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed';
                    }
                }
            }
        }

        // Render Riwayat Absensi Karyawan Aktif (5 terakhir)
        const historyTbody = document.getElementById('personal-attendance-history');
        if (historyTbody) {
            const myLogs = window.HadirkuService.state.attendanceLogs
                .filter(l => l.employee_id === emp.id)
                .slice(0, 7);

            if (myLogs.length === 0) {
                historyTbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-sm text-slate-400">Belum ada riwayat absensi untuk ${emp.name}</td></tr>`;
            } else {
                historyTbody.innerHTML = myLogs
                    .map(log => {
                        const badgeClass =
                            log.status === 'Hadir'
                                ? 'bg-emerald-100 text-emerald-700'
                                : log.status === 'Terlambat'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700';
                        return `
                            <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition">
                                <td class="py-3 px-3 text-xs font-semibold text-slate-800">${log.date}</td>
                                <td class="py-3 px-3 text-xs font-mono-clock text-emerald-700 font-semibold">${log.clock_in || '-'}</td>
                                <td class="py-3 px-3 text-xs font-mono-clock text-indigo-700 font-semibold">${log.clock_out || '-'}</td>
                                <td class="py-3 px-3">
                                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badgeClass}">${log.status}</span>
                                    ${log.late_minutes > 0 ? `<span class="text-[11px] text-amber-600 ml-1">(${log.late_minutes}m)</span>` : ''}
                                </td>
                                <td class="py-3 px-3 text-xs text-slate-600">${log.method} • <span class="text-slate-400">${log.location_label || '-'}</span></td>
                                <td class="py-3 px-3 text-right">
                                    ${
                                        log.photo_in
                                            ? `<button onclick="App.openPhotoModal('${log.id}')" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer">Lihat Bukti</button>`
                                            : '<span class="text-xs text-slate-400">-</span>'
                                    }
                                </td>
                            </tr>
                        `;
                    })
                    .join('');
            }
        }
    },

    // ========================================================================
    // TAB 2: SCAN QR CODE & KARTU ID DIGITAL
    // ========================================================================
    renderQrCodes() {
        const emp = this.currentEmployee;
        const s = this.officeSettings;

        // Update informasi Kartu ID Karyawan
        const cardName = document.getElementById('idcard-emp-name');
        const cardRole = document.getElementById('idcard-emp-role');
        const cardNip = document.getElementById('idcard-emp-nip');
        const cardDept = document.getElementById('idcard-emp-dept');
        const cardCompany = document.getElementById('idcard-company-name');
        const gateTokenText = document.getElementById('office-qr-token-display');

        if (cardName) cardName.textContent = emp.name;
        if (cardRole) cardRole.textContent = emp.position;
        if (cardNip) cardNip.textContent = emp.nip;
        if (cardDept) cardDept.textContent = emp.department;
        if (cardCompany) cardCompany.textContent = s.company_name;
        if (gateTokenText) gateTokenText.textContent = s.office_qr_secret;

        // Render QR Code Karyawan & QR Code Gate Kantor
        const empQrContainer = document.getElementById('employee-qrcode-box');
        const officeQrContainer = document.getElementById('office-qrcode-box');

        if (window.QRCode) {
            if (empQrContainer) {
                empQrContainer.innerHTML = '';
                const payload = JSON.stringify({
                    type: 'HADIRKU_EMP_CARD',
                    employee_id: emp.id,
                    nip: emp.nip,
                    name: emp.name
                });
                new QRCode(empQrContainer, {
                    text: payload,
                    width: 148,
                    height: 148,
                    colorDark: '#1e1b4b',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            }

            if (officeQrContainer) {
                officeQrContainer.innerHTML = '';
                new QRCode(officeQrContainer, {
                    text: s.office_qr_secret,
                    width: 148,
                    height: 148,
                    colorDark: '#0f172a',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }
    },

    async startQrScanner() {
        const readerEl = document.getElementById('qr-reader-viewport');
        if (!readerEl || !window.Html5Qrcode) {
            this.showToast('Library QR Scanner belum siap, gunakan tombol Simulasi Scan QR.', 'warning');
            return;
        }

        if (this.isQrScannerRunning) {
            await this.stopQrScanner();
            return;
        }

        try {
            this.html5QrScanner = new Html5Qrcode('qr-reader-viewport');
            this.isQrScannerRunning = true;
            const btn = document.getElementById('btn-toggle-qr-camera');
            if (btn) btn.textContent = 'Matikan Kamera Scanner QR';

            await this.html5QrScanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 220, height: 220 } },
                decodedText => {
                    this.handleQrScanResult(decodedText);
                    this.stopQrScanner();
                },
                () => {}
            );
        } catch (err) {
            this.isQrScannerRunning = false;
            this.showToast('Kamera tidak dapat diakses untuk scan QR. Gunakan tombol Simulasi Scan Instan di bawah.', 'warning');
        }
    },

    async stopQrScanner() {
        if (this.html5QrScanner && this.isQrScannerRunning) {
            try {
                await this.html5QrScanner.stop();
                this.html5QrScanner.clear();
            } catch (e) {
                console.warn(e);
            }
        }
        this.isQrScannerRunning = false;
        const btn = document.getElementById('btn-toggle-qr-camera');
        if (btn) btn.textContent = 'Aktifkan Kamera Scan QR';
    },

    async handleQrScanResult(rawCode) {
        const code = (rawCode || '').trim();
        if (!code) {
            this.showToast('Kode QR kosong!', 'error');
            return;
        }

        const s = this.officeSettings;
        let targetEmp = this.currentEmployee;

        // Cek apakah QR adalah JSON Kartu ID Karyawan
        if (code.startsWith('{')) {
            try {
                const parsed = JSON.parse(code);
                if (parsed.type === 'HADIRKU_EMP_CARD' && parsed.employee_id) {
                    const found = window.HadirkuService.state.employees.find(e => e.id === parsed.employee_id);
                    if (found) {
                        this.switchEmployee(found.id);
                        targetEmp = found;
                    }
                }
            } catch (e) {
                // Bukan JSON
            }
        } else if (code !== s.office_qr_secret) {
            // Cek apakah kode cocok dengan NIP atau ID karyawan
            const foundByNip = window.HadirkuService.state.employees.find(
                e => e.nip === code || e.id.toLowerCase() === code.toLowerCase()
            );
            if (foundByNip) {
                this.switchEmployee(foundByNip.id);
                targetEmp = foundByNip;
            } else {
                this.showToast(`Kode QR "${code}" tidak dikenali! Gunakan token Gate Kantor (${s.office_qr_secret}) atau NIP Karyawan.`, 'error');
                return;
            }
        }

        // Tentukan apakah Absen Masuk atau Absen Pulang otomatis
        const todayLog = this.getTodayAttendanceForCurrentEmployee();
        if (!todayLog || !todayLog.clock_in || todayLog.clock_in === '-') {
            await this.submitClockAction('in', 'QR Code');
        } else if (!todayLog.clock_out) {
            await this.submitClockAction('out', 'QR Code');
        } else {
            this.showToast(`${targetEmp.name} sudah menyelesaikan Absen Masuk & Pulang hari ini.`, 'info');
        }
    },

    simulateInstantQrScan() {
        const s = this.officeSettings;
        this.handleQrScanResult(s.office_qr_secret);
    },

    submitManualQrCode() {
        const input = document.getElementById('manual-qr-input');
        if (!input || !input.value.trim()) {
            this.showToast('Masukkan kode QR Gate atau NIP karyawan terlebih dahulu', 'warning');
            return;
        }
        this.handleQrScanResult(input.value.trim());
        input.value = '';
    },

    // ========================================================================
    // TAB 3: PENGAJUAN IZIN, SAKIT, CUTI & LEMBUR
    // ========================================================================
    renderLeaveTab() {
        const emp = this.currentEmployee;
        const allReqs = window.HadirkuService.state.leaveRequests;

        // Statistik kuota cuti & lembur karyawan aktif
        const quotaEl = document.getElementById('leave-quota-remaining');
        const pendingEl = document.getElementById('leave-pending-count');
        const approvedEl = document.getElementById('leave-approved-count');

        if (quotaEl) quotaEl.textContent = `${emp.leave_quota} Hari`;
        if (pendingEl) {
            pendingEl.textContent = allReqs.filter(r => r.status === 'Menunggu').length;
        }
        if (approvedEl) {
            approvedEl.textContent = allReqs.filter(r => r.status === 'Disetujui').length;
        }

        // Default tanggal form jika kosong
        const startInput = document.getElementById('req-start-date');
        const endInput = document.getElementById('req-end-date');
        if (startInput && !startInput.value) startInput.value = window.getLocalDateStr(0);
        if (endInput && !endInput.value) endInput.value = window.getLocalDateStr(0);

        // Tabel Daftar Pengajuan & Approval
        const tbody = document.getElementById('leave-requests-tbody');
        if (!tbody) return;

        if (allReqs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-sm text-slate-400">Belum ada pengajuan izin, cuti, atau lembur.</td></tr>`;
            return;
        }

        tbody.innerHTML = allReqs
            .map(req => {
                const statusBadge =
                    req.status === 'Disetujui'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : req.status === 'Ditolak'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200';

                const typeBadge =
                    req.type === 'Lembur'
                        ? 'bg-indigo-100 text-indigo-800'
                        : req.type === 'Sakit'
                        ? 'bg-rose-100 text-rose-700'
                        : req.type === 'Cuti'
                        ? 'bg-violet-100 text-violet-700'
                        : 'bg-sky-100 text-sky-700';

                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition">
                        <td class="py-3.5 px-3">
                            <p class="text-xs font-bold text-slate-900">${req.employee_name}</p>
                            <p class="text-[11px] text-slate-500">${req.department}</p>
                        </td>
                        <td class="py-3.5 px-3">
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${typeBadge}">${req.type}</span>
                            ${req.overtime_hours > 0 ? `<p class="text-[11px] text-indigo-600 font-semibold mt-1">${req.overtime_hours} Jam</p>` : ''}
                        </td>
                        <td class="py-3.5 px-3 text-xs text-slate-700 font-medium">
                            ${req.start_date} ${req.end_date && req.end_date !== req.start_date ? `<span class="text-slate-400">s/d</span> ${req.end_date}` : ''}
                        </td>
                        <td class="py-3.5 px-3 text-xs text-slate-600 max-w-xs">
                            <p class="line-clamp-2">${req.reason}</p>
                            ${req.attachment_name ? `<p class="text-[11px] text-indigo-600 mt-0.5">📎 ${req.attachment_name}</p>` : ''}
                        </td>
                        <td class="py-3.5 px-3">
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge}">${req.status}</span>
                            ${req.reviewed_by ? `<p class="text-[10px] text-slate-400 mt-1">Oleh: ${req.reviewed_by}</p>` : ''}
                        </td>
                        <td class="py-3.5 px-3 text-right">
                            ${
                                req.status === 'Menunggu'
                                    ? `
                                    <div class="inline-flex items-center gap-1.5">
                                        <button onclick="App.reviewRequest('${req.id}', 'Disetujui')" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer">Setujui</button>
                                        <button onclick="App.reviewRequest('${req.id}', 'Ditolak')" class="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer">Tolak</button>
                                    </div>
                                    `
                                    : `<span class="text-xs text-slate-400">Selesai</span>`
                            }
                        </td>
                    </tr>
                `;
            })
            .join('');
    },

    toggleOvertimeHoursField() {
        const typeSelect = document.getElementById('req-type');
        const overtimeWrapper = document.getElementById('overtime-hours-wrapper');
        if (!typeSelect || !overtimeWrapper) return;
        if (typeSelect.value === 'Lembur') {
            overtimeWrapper.classList.remove('hidden');
        } else {
            overtimeWrapper.classList.add('hidden');
        }
    },

    async submitLeaveOrOvertimeForm(e) {
        e.preventDefault();
        const emp = this.currentEmployee;
        const type = document.getElementById('req-type').value;
        const startDate = document.getElementById('req-start-date').value;
        const endDate = document.getElementById('req-end-date').value || startDate;
        const overtimeHours = Number(document.getElementById('req-overtime-hours')?.value || 0);
        const reason = document.getElementById('req-reason').value.trim();
        const attachmentInput = document.getElementById('req-attachment');

        if (!reason) {
            this.showToast('Harap isi alasan pengajuan terlebih dahulu!', 'warning');
            return;
        }

        const fileName =
            attachmentInput && attachmentInput.files && attachmentInput.files[0]
                ? attachmentInput.files[0].name
                : '';

        const newReq = {
            id: `REQ-${Date.now().toString().slice(-6)}`,
            employee_id: emp.id,
            employee_name: emp.name,
            department: emp.department,
            type,
            start_date: startDate,
            end_date: endDate,
            overtime_hours: type === 'Lembur' ? overtimeHours : 0,
            reason,
            attachment_name: fileName,
            status: 'Menunggu',
            reviewed_by: null,
            reviewed_at: null,
            created_at: new Date().toISOString()
        };

        await window.HadirkuService.addLeaveRequest(newReq);
        document.getElementById('req-reason').value = '';
        if (attachmentInput) attachmentInput.value = '';
        this.renderAllActiveViews();
        this.showToast(`Pengajuan ${type} atas nama ${emp.name} berhasil dikirim!`, 'success');
    },

    async reviewRequest(reqId, decision) {
        const reviewer = this.currentEmployee.name;
        const updated = await window.HadirkuService.updateLeaveRequestStatus(reqId, decision, reviewer);
        if (updated) {
            this.renderAllActiveViews();
            this.showToast(`Pengajuan ${updated.type} (${updated.employee_name}) telah ${decision}.`, decision === 'Disetujui' ? 'success' : 'info');
        }
    },

    // ========================================================================
    // TAB 4: DASHBOARD REKAP ADMIN & EXPORT LAPORAN (EXCEL / CSV / PDF)
    // ========================================================================
    getFilteredAttendanceLogs() {
        const dateFilter = document.getElementById('filter-date')?.value || '';
        const deptFilter = document.getElementById('filter-department')?.value || 'ALL';
        const statusFilter = document.getElementById('filter-status')?.value || 'ALL';
        const searchFilter = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();

        return window.HadirkuService.state.attendanceLogs.filter(log => {
            if (dateFilter && log.date !== dateFilter) return false;
            if (deptFilter !== 'ALL' && log.department !== deptFilter) return false;
            if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
            if (
                searchFilter &&
                !log.employee_name.toLowerCase().includes(searchFilter) &&
                !log.employee_id.toLowerCase().includes(searchFilter)
            ) {
                return false;
            }
            return true;
        });
    },

    renderAdminRecapTab() {
        const allLogs = window.HadirkuService.state.attendanceLogs;
        const allEmps = window.HadirkuService.state.employees;
        const today = window.getLocalDateStr(0);

        // Hitung KPI Hari Ini & Keseluruhan
        const todayLogs = allLogs.filter(l => l.date === today);
        const presentToday = todayLogs.filter(l => l.status === 'Hadir' || l.status === 'Terlambat').length;
        const lateToday = todayLogs.filter(l => l.status === 'Terlambat').length;
        const leaveToday = todayLogs.filter(l => ['Izin', 'Sakit', 'Cuti', 'Dinas Luar'].includes(l.status)).length;
        const totalOvertimeMins = allLogs.reduce((acc, l) => acc + Number(l.overtime_minutes || 0), 0);

        const elPresent = document.getElementById('kpi-present-today');
        const elLate = document.getElementById('kpi-late-today');
        const elLeave = document.getElementById('kpi-leave-today');
        const elOvertime = document.getElementById('kpi-total-overtime');

        if (elPresent) elPresent.textContent = `${presentToday} / ${allEmps.length}`;
        if (elLate) elLate.textContent = `${lateToday} Orang`;
        if (elLeave) elLeave.textContent = `${leaveToday} Orang`;
        if (elOvertime) elOvertime.textContent = `${(totalOvertimeMins / 60).toFixed(1)} Jam`;

        // Render Tabel Rekap
        const filtered = this.getFilteredAttendanceLogs();
        const tbody = document.getElementById('admin-recap-tbody');
        const countBadge = document.getElementById('recap-row-count');
        if (countBadge) countBadge.textContent = `${filtered.length} Data Absensi`;

        if (!tbody) return;
        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="py-10 text-center text-sm text-slate-400">Tidak ada data absensi yang sesuai dengan filter.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered
            .map(log => {
                const badgeClass =
                    log.status === 'Hadir'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.status === 'Terlambat'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800';

                return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50/90 transition">
                        <td class="py-3.5 px-3 text-xs font-semibold text-slate-800 whitespace-nowrap">${log.date}</td>
                        <td class="py-3.5 px-3">
                            <p class="text-xs font-bold text-slate-900">${log.employee_name}</p>
                            <p class="text-[11px] text-slate-500">${log.employee_id} • ${log.department}</p>
                        </td>
                        <td class="py-3.5 px-3 text-xs font-mono-clock font-semibold text-emerald-700">${log.clock_in || '-'}</td>
                        <td class="py-3.5 px-3 text-xs font-mono-clock font-semibold text-indigo-700">${log.clock_out || '-'}</td>
                        <td class="py-3.5 px-3">
                            <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${badgeClass}">${log.status}</span>
                            ${log.late_minutes > 0 ? `<div class="text-[10px] text-amber-600 font-medium mt-0.5">Telat ${log.late_minutes} mnt</div>` : ''}
                        </td>
                        <td class="py-3.5 px-3 text-xs text-slate-700 font-medium">
                            ${log.work_hours > 0 ? `${log.work_hours} jam` : '-'}
                            ${log.overtime_minutes > 0 ? `<div class="text-[10px] text-indigo-600 font-semibold">+Lembur ${log.overtime_minutes}m</div>` : ''}
                        </td>
                        <td class="py-3.5 px-3 text-xs text-slate-600">
                            <div class="font-medium text-slate-800">${log.method}</div>
                            <div class="text-[11px] text-slate-400">${log.location_label || '-'}</div>
                        </td>
                        <td class="py-3.5 px-3 text-xs text-slate-500 max-w-[180px] truncate" title="${log.notes || ''}">${log.notes || '-'}</td>
                        <td class="py-3.5 px-3 text-right whitespace-nowrap no-print">
                            ${
                                log.photo_in
                                    ? `<button onclick="App.openPhotoModal('${log.id}')" class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer">Foto & GPS</button>`
                                    : `<span class="text-xs text-slate-400">-</span>`
                            }
                        </td>
                    </tr>
                `;
            })
            .join('');
    },

    resetRecapFilters() {
        const d = document.getElementById('filter-date');
        const dept = document.getElementById('filter-department');
        const st = document.getElementById('filter-status');
        const s = document.getElementById('filter-search');
        if (d) d.value = '';
        if (dept) dept.value = 'ALL';
        if (st) st.value = 'ALL';
        if (s) s.value = '';
        this.renderAdminRecapTab();
    },

    // Export ke CSV
    exportToCSV() {
        const rows = this.getFilteredAttendanceLogs();
        if (rows.length === 0) {
            this.showToast('Tidak ada data untuk di-export!', 'warning');
            return;
        }

        const headers = [
            'ID Absen',
            'Tanggal',
            'ID Karyawan',
            'Nama Karyawan',
            'Departemen',
            'Jam Masuk',
            'Jam Pulang',
            'Status',
            'Terlambat (Menit)',
            'Lembur (Menit)',
            'Durasi Kerja (Jam)',
            'Metode',
            'Lokasi GPS',
            'Koordinat Lat',
            'Koordinat Lng',
            'Catatan'
        ];

        const escapeCsv = val => `"${String(val ?? '').replace(/"/g, '""')}"`;

        const csvContent = [
            headers.map(escapeCsv).join(','),
            ...rows.map(r =>
                [
                    r.id,
                    r.date,
                    r.employee_id,
                    r.employee_name,
                    r.department,
                    r.clock_in || '-',
                    r.clock_out || '-',
                    r.status,
                    r.late_minutes || 0,
                    r.overtime_minutes || 0,
                    r.work_hours || 0,
                    r.method,
                    r.location_label || '-',
                    r.lat ?? '',
                    r.lng ?? '',
                    r.notes || ''
                ]
                    .map(escapeCsv)
                    .join(',')
            )
        ].join('\r\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rekap_Absensi_HadirKu_${window.getLocalDateStr(0)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('File CSV berhasil di-download (Siap dibuka di Microsoft Excel / Google Sheets)!', 'success');
    },

    // Export ke format Excel (.xls HTML Table)
    exportToExcel() {
        const rows = this.getFilteredAttendanceLogs();
        if (rows.length === 0) {
            this.showToast('Tidak ada data untuk di-export!', 'warning');
            return;
        }

        const s = this.officeSettings;
        let tableHtml = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="UTF-8"></head>
            <body>
                <h2>LAPORAN REKAPITULASI ABSENSI KARYAWAN - ${s.company_name}</h2>
                <p>Tanggal Cetak: ${new Date().toLocaleString('id-ID')}</p>
                <table border="1" cellpadding="6" cellspacing="0">
                    <thead style="background-color:#312e81;color:#ffffff;font-weight:bold;">
                        <tr>
                            <th>Tanggal</th>
                            <th>ID Karyawan</th>
                            <th>Nama Karyawan</th>
                            <th>Departemen</th>
                            <th>Jam Masuk</th>
                            <th>Jam Pulang</th>
                            <th>Status</th>
                            <th>Terlambat (Menit)</th>
                            <th>Lembur (Menit)</th>
                            <th>Jam Kerja</th>
                            <th>Metode</th>
                            <th>Lokasi GPS</th>
                            <th>Catatan</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows
                            .map(
                                r => `
                            <tr>
                                <td>${r.date}</td>
                                <td>${r.employee_id}</td>
                                <td>${r.employee_name}</td>
                                <td>${r.department}</td>
                                <td>${r.clock_in || '-'}</td>
                                <td>${r.clock_out || '-'}</td>
                                <td>${r.status}</td>
                                <td>${r.late_minutes || 0}</td>
                                <td>${r.overtime_minutes || 0}</td>
                                <td>${r.work_hours || 0}</td>
                                <td>${r.method}</td>
                                <td>${r.location_label || '-'}</td>
                                <td>${r.notes || '-'}</td>
                            </tr>`
                            )
                            .join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Laporan_Absensi_${s.company_name.replace(/\s+/g, '_')}_${window.getLocalDateStr(0)}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Laporan Excel (.xls) berhasil di-download!', 'success');
    },

    // ========================================================================
    // TAB 5: PENGATURAN KANTOR, KELOLA KARYAWAN & INTEGRASI SUPABASE
    // ========================================================================
    renderSettingsTab() {
        const s = this.officeSettings;
        const cfg = window.HadirkuService.cloudConfig;

        // Isi form pengaturan kantor
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val ?? '';
        };
        const setCheck = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.checked = Boolean(val);
        };

        setVal('set-company-name', s.company_name);
        setVal('set-work-start', s.work_start_time);
        setVal('set-late-tolerance', s.late_tolerance_minutes);
        setVal('set-work-end', s.work_end_time);
        setVal('set-office-lat', s.office_lat);
        setVal('set-office-lng', s.office_lng);
        setVal('set-max-radius', s.max_radius_meters);
        setVal('set-qr-secret', s.office_qr_secret);
        setCheck('set-enforce-geofence', s.enforce_geofence);
        setCheck('set-require-selfie', s.require_selfie);

        // Isi form konfigurasi Supabase
        setVal('supabase-url-input', cfg.url);
        setVal('supabase-key-input', cfg.anonKey);

        // Render Daftar Karyawan
        const empTbody = document.getElementById('settings-employees-tbody');
        if (empTbody) {
            empTbody.innerHTML = window.HadirkuService.state.employees
                .map(
                    emp => `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td class="py-3 px-3">
                            <p class="text-xs font-mono-clock font-bold text-indigo-700">${emp.nip}</p>
                            <p class="text-[11px] font-mono-clock text-slate-500">user: <b>${emp.username || emp.name.split(' ')[0].toLowerCase()}</b></p>
                        </td>
                        <td class="py-3 px-3">
                            <p class="text-xs font-bold text-slate-900">${emp.name}</p>
                            <p class="text-[11px] text-slate-500">${emp.email}</p>
                        </td>
                        <td class="py-3 px-3 text-xs text-slate-700">${emp.position} • <span class="font-semibold">${emp.department}</span></td>
                        <td class="py-3 px-3">
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                emp.role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                            }">${emp.role === 'admin' ? 'Admin HRD' : 'Karyawan'}</span>
                        </td>
                        <td class="py-3 px-3 text-xs font-semibold text-slate-700">${emp.leave_quota} Hari</td>
                        <td class="py-3 px-3 text-right">
                            <button onclick="App.removeEmployee('${emp.id}')" class="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer">Hapus</button>
                        </td>
                    </tr>
                `
                )
                .join('');
        }
    },

    async saveOfficeSettingsForm(e) {
        e.preventDefault();
        const newSettings = {
            company_name: document.getElementById('set-company-name').value.trim(),
            work_start_time: document.getElementById('set-work-start').value,
            late_tolerance_minutes: Number(document.getElementById('set-late-tolerance').value || 0),
            work_end_time: document.getElementById('set-work-end').value,
            office_lat: Number(document.getElementById('set-office-lat').value),
            office_lng: Number(document.getElementById('set-office-lng').value),
            max_radius_meters: Number(document.getElementById('set-max-radius').value || 150),
            office_qr_secret: document.getElementById('set-qr-secret').value.trim() || 'HADIRKU-GATE-2026-HQ',
            enforce_geofence: document.getElementById('set-enforce-geofence').checked,
            require_selfie: document.getElementById('set-require-selfie').checked
        };

        await window.HadirkuService.updateOfficeSettings(newSettings);
        this.recalculateGpsDistance();
        this.renderAllActiveViews();
        this.showToast('Pengaturan jam kerja & geofencing kantor berhasil disimpan!', 'success');
    },

    async addNewEmployeeForm(e) {
        e.preventDefault();
        const name = document.getElementById('new-emp-name').value.trim();
        const nip = document.getElementById('new-emp-nip').value.trim();
        const username = (document.getElementById('new-emp-username')?.value || '').trim().toLowerCase() || name.split(' ')[0].toLowerCase();
        const password = document.getElementById('new-emp-password')?.value || 'karyawan123';
        const email = document.getElementById('new-emp-email').value.trim();
        const department = document.getElementById('new-emp-dept').value;
        const position = document.getElementById('new-emp-position').value.trim();
        const role = document.getElementById('new-emp-role').value;

        if (!name || !nip) {
            this.showToast('Nama dan NIP wajib diisi!', 'warning');
            return;
        }

        const empId = `EMP-${String(window.HadirkuService.state.employees.length + 1).padStart(3, '0')}-${Date.now().toString().slice(-2)}`;
        await window.HadirkuService.upsertEmployee({
            id: empId,
            nip,
            username,
            password,
            name,
            email: email || `${name.toLowerCase().replace(/\s+/g, '.')}@nusantaradigital.id`,
            department,
            position: position || 'Staff',
            role,
            phone: '0812-0000-0000',
            leave_quota: 12,
            avatar_color: 'indigo',
            active: true
        });

        e.target.reset();
        const passEl = document.getElementById('new-emp-password');
        if (passEl) passEl.value = 'karyawan123';
        this.renderAllActiveViews();
        this.showToast(`Karyawan baru (${name} — user: ${username}) berhasil ditambahkan!`, 'success');
    },

    async removeEmployee(empId) {
        if (window.HadirkuService.state.employees.length <= 1) {
            this.showToast('Minimal harus ada 1 karyawan aktif di sistem!', 'warning');
            return;
        }
        await window.HadirkuService.deleteEmployee(empId);
        if (this.currentEmployeeId === empId) {
            this.currentEmployeeId = window.HadirkuService.state.employees[0].id;
        }
        this.renderAllActiveViews();
        this.showToast('Data karyawan berhasil dihapus.', 'info');
    },

    // Simpan & Konek ke Supabase Cloud
    async connectSupabaseForm(e) {
        e.preventDefault();
        const url = document.getElementById('supabase-url-input').value.trim();
        const key = document.getElementById('supabase-key-input').value.trim();

        if (!url || !key) {
            window.HadirkuService.saveCloudConfig('', '', false);
            this.updateCloudBadge();
            this.showToast('Mode Demo Lokal diaktifkan.', 'info');
            return;
        }

        window.HadirkuService.saveCloudConfig(url, key, true);
        this.updateCloudBadge();
        this.showToast('Menghubungkan & menguji koneksi ke Supabase...', 'info');

        const res = await window.HadirkuService.fetchFromCloud();
        if (res.ok) {
            this.renderAllActiveViews();
            this.showToast(res.message, 'success');
        } else {
            this.showToast(res.message, 'warning');
        }
    },

    async pushLocalDataToSupabase() {
        this.showToast('Mengunggah seluruh data lokal ke tabel Supabase...', 'info');
        const res = await window.HadirkuService.syncLocalToCloud();
        if (res.ok) {
            this.showToast(res.message, 'success');
        } else {
            this.showToast(res.message, 'error');
        }
    },

    disconnectSupabase() {
        window.HadirkuService.saveCloudConfig('', '', false);
        this.renderAllActiveViews();
        this.showToast('Koneksi Cloud diputus. Kembali ke Mode Demo Lokal.', 'info');
    },

    // Modal Bukti Foto Selfie & Detail GPS
    openPhotoModal(logId) {
        const log = window.HadirkuService.state.attendanceLogs.find(l => l.id === logId);
        if (!log) return;

        const modal = document.getElementById('photo-evidence-modal');
        const content = document.getElementById('photo-evidence-content');
        if (!modal || !content) return;

        content.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                    <h4 class="text-base font-bold text-slate-900">Bukti Kehadiran & Geotagging</h4>
                    <p class="text-xs text-slate-500">${log.employee_name} (${log.employee_id}) • ${log.date}</p>
                </div>
                <button onclick="App.closePhotoModal()" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">✕</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p class="text-xs font-bold text-emerald-700 mb-2">📸 Foto Absen Masuk (${log.clock_in || '-'})</p>
                    ${
                        log.photo_in
                            ? `<img src="${log.photo_in}" alt="Selfie Masuk" class="w-full h-44 object-cover rounded-lg border border-slate-200"/>`
                            : `<div class="h-44 flex items-center justify-center text-xs text-slate-400 bg-slate-100 rounded-lg">Tidak ada foto masuk</div>`
                    }
                </div>
                <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p class="text-xs font-bold text-indigo-700 mb-2">📸 Foto Absen Pulang (${log.clock_out || 'Belum Pulang'})</p>
                    ${
                        log.photo_out
                            ? `<img src="${log.photo_out}" alt="Selfie Pulang" class="w-full h-44 object-cover rounded-lg border border-slate-200"/>`
                            : `<div class="h-44 flex items-center justify-center text-xs text-slate-400 bg-slate-100 rounded-lg">Belum ada foto pulang</div>`
                    }
                </div>
            </div>
            <div class="mt-4 p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs space-y-1">
                <p><span class="font-semibold text-slate-700">Metode Verifikasi:</span> ${log.method}</p>
                <p><span class="font-semibold text-slate-700">Titik Lokasi GPS:</span> ${log.location_label || '-'} ${log.lat ? `(${log.lat}, ${log.lng})` : ''}</p>
                <p><span class="font-semibold text-slate-700">Catatan:</span> ${log.notes || '-'}</p>
            </div>
        `;
        modal.classList.remove('hidden');
    },

    closePhotoModal() {
        const modal = document.getElementById('photo-evidence-modal');
        if (modal) modal.classList.add('hidden');
    },

    // Toast Notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const colors = {
            success: 'bg-emerald-600 text-white border-emerald-700',
            error: 'bg-rose-600 text-white border-rose-700',
            warning: 'bg-amber-500 text-white border-amber-600',
            info: 'bg-slate-900 text-white border-slate-800'
        };

        const toast = document.createElement('div');
        toast.className = `toast-enter px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 max-w-sm ${colors[type] || colors.info}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, 3600);
    }
};

window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
