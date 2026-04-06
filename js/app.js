// Main Application Controller for Sufa Flight Tracker

const App = {
    currentView: 'form',
    allRecords: [],
    units: [],
    malfunctionTypes: [],
    malfunctionSeverities: [],
    charts: {},
    isInitialized: false, // Prevent double-init
    editingId: null,
    unsubscribers: [], // Track Firestore listeners
    pwaInstallPrompt: null,

    checkPWAStatus: () => {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (isStandalone) {
            // Already installed
            document.getElementById('pwa-install-section').classList.add('hidden');
            document.getElementById('pwa-install-header-btn').classList.add('hidden');
            return;
        }

        if (isIOS) {
            // Show guide for iOS users after Login or on Init
            setTimeout(() => {
                const guideShown = localStorage.getItem('ios_guide_shown');
                if (!guideShown) {
                    App.showInstallGuide();
                    localStorage.setItem('ios_guide_shown', 'true');
                }
            }, 3000);
        }
    },

    showInstallGuide: () => {
        document.getElementById('ios-install-modal').classList.remove('hidden');
        lucide.createIcons();
    },

    init: () => {
        if (App.isInitialized) return;
        App.isInitialized = true;

        // Initialize Auth
        Auth.init();

        // PWA Install Handling
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            App.pwaInstallPrompt = e;
            // Show install buttons
            document.getElementById('pwa-install-section').classList.remove('hidden');
            document.getElementById('pwa-install-header-btn').classList.remove('hidden');
        });

        const installBtn = document.getElementById('pwa-install-btn');
        const headerInstallBtn = document.getElementById('pwa-install-header-btn');

        const triggerInstall = async () => {
            if (!App.pwaInstallPrompt) return;
            App.pwaInstallPrompt.prompt();
            const { outcome } = await App.pwaInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                App.pwaInstallPrompt = null;
                document.getElementById('pwa-install-section').classList.add('hidden');
                document.getElementById('pwa-install-header-btn').classList.add('hidden');
            }
        };

        installBtn.addEventListener('click', triggerInstall);
        headerInstallBtn.addEventListener('click', triggerInstall);

        // iOS Install Guide
        document.getElementById('ios-modal-close').addEventListener('click', () => {
            document.getElementById('ios-install-modal').classList.add('hidden');
        });

        // Check if should show iOS guide
        App.checkPWAStatus();
        
        // Navigation Logic - Only once
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                if (view === 'form') App.editingId = null; // Clear if manual new
                App.switchView(view);
            });
        });

        const cancelBtn = document.getElementById('cancel-edit-btn');
        cancelBtn.addEventListener('click', () => {
            App.editingId = null;
            App.switchView('records');
        });

        // Form Calculation Logic
        const takeoffInput = document.getElementById('takeoff-time');
        const landingInput = document.getElementById('landing-time');
        const calcDisplay = document.getElementById('calc-total-time');

        const updateCalc = () => {
            const mins = Utils.calculateMinutes(takeoffInput.value, landingInput.value);
            calcDisplay.innerText = mins;
        };

        takeoffInput.addEventListener('change', updateCalc);
        landingInput.addEventListener('change', updateCalc);

        // Dynamic Malfunctions Logic
        document.getElementById('add-malfunction-btn').addEventListener('click', () => {
            App.addMalfunctionRow();
        });

        // Flight Form Submission (Create or Update)
        document.getElementById('flight-log-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const malfEntries = [];
            document.querySelectorAll('.malfunction-entry-row').forEach(row => {
                const type = row.querySelector('.malf-type-select').value;
                const severity = row.querySelector('.malf-sev-select').value;
                if (type) malfEntries.push({ type, severity });
            });

            const formData = {
                operatingUnit: document.getElementById('operating-unit').value,
                droneTailNumber: document.getElementById('tail-number').value,
                flightDate: document.getElementById('flight-date').value,
                takeoffTime: document.getElementById('takeoff-time').value,
                landingTime: document.getElementById('landing-time').value,
                landingReason: document.querySelector('input[name="landing-reason"]:checked').value,
                malfunctions: malfEntries,
                notes: document.getElementById('general-notes').value || null,
            };

            // Validation
            const mins = Utils.calculateMinutes(formData.takeoffTime, formData.landingTime);
            if (mins <= 0) {
                Utils.showToast('זמן נחיתה חייב להיות אחרי המראה', 'error');
                return;
            }

            try {
                let savedRecord;
                if (App.editingId) {
                    savedRecord = await Database.updateFlightRecord(App.editingId, formData);
                    Utils.showToast('רישום עודכן בהצלחה', 'success');
                } else {
                    savedRecord = await Database.saveFlightRecord(formData);
                    Utils.showToast('טיסה נשמרה בהצלחה', 'success');
                }
                
                const finalRecord = { ...formData, ...savedRecord };
                
                App.editingId = null;
                e.target.reset();
                calcDisplay.innerText = '0';
                document.getElementById('malfunctions-list').innerHTML = '';
                App.loadTailSuggestions();
                
                // Show Tactical Success Modal with WhatsApp option
                App.showSuccessModal(finalRecord);

                // Switch back to records after update
                if (App.currentView === 'form' && formData.operatingUnit) {
                    // We stay on the modal, it will handle the navigation if needed
                }
            } catch (error) {
                Utils.showToast('שגיאה בשמירת נתונים', 'error');
            }
        });

        // Admin Management
        document.getElementById('add-unit-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-unit-name').value;
            await Database.addUnit(name);
            e.target.reset();
        });

        document.getElementById('add-malfunction-type-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-malfunction-name').value;
            await Database.addMalfunctionType(name);
            e.target.reset();
        });

        document.getElementById('add-malfunction-severity-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-severity-name').value;
            await Database.addMalfunctionSeverity(name);
            e.target.reset();
        });

        // Records Search & Filters
        document.getElementById('record-search').addEventListener('input', (e) => {
            App.renderRecords(e.target.value);
        });

        document.getElementById('record-date-from').addEventListener('change', () => App.renderRecords());
        document.getElementById('record-date-to').addEventListener('change', () => App.renderRecords());

        document.getElementById('export-csv-btn').addEventListener('click', () => App.exportToCSV());

        // Date & Tail Filters for Dashboard
        document.getElementById('dash-date-from').addEventListener('change', () => App.updateDashboard());
        document.getElementById('dash-date-to').addEventListener('change', () => App.updateDashboard());
        document.getElementById('dash-tail-filter').addEventListener('change', () => App.updateDashboard());

        // Global Modal Close
        document.getElementById('modal-close').addEventListener('click', () => App.closeModal());
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') App.closeModal();
        });

        // Malfunction Summary Click (Dashboard)
        document.querySelector('.stat-card.urgent').addEventListener('click', () => {
            if (App.currentFilteredRecords) App.showMalfunctionBreakdown(App.currentFilteredRecords);
        });
    },

    showModal: (title, htmlContent) => {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = htmlContent;
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
        lucide.createIcons();
    },

    closeModal: () => {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.body.style.overflow = '';
    },

    showSuccessModal: (record) => {
        const content = `
            <div style="text-align: center; padding: 20px 0;">
                <div class="success-icon">
                    <i data-lucide="check-circle" style="color: var(--accent); width: 64px; height: 64px;"></i>
                </div>
                <h3 style="margin: 15px 0 5px; font-size: 1.4rem;">הרישום נשמר בהצלחה!</h3>
                <p style="color: var(--text-secondary); margin-bottom: 25px;">מה תרצה לעשות עכשיו?</p>
                
                <div class="whatsapp-card" id="whatsapp-share-btn">
                    <div class="whatsapp-icon"><i data-lucide="message-circle"></i></div>
                    <div class="whatsapp-text">שליחת סיכום ל-WhatsApp</div>
                </div>

                <button id="success-close-btn" class="btn-secondary" style="margin-top: 20px; width: 100%;">חזרה להיסטוריית טיסות</button>
            </div>
        `;

        App.showModal('בוצע!', content);
        
        // Listeners for the Success Modal
        document.getElementById('whatsapp-share-btn').addEventListener('click', () => {
            const msg = Utils.formatWhatsAppMessage(record);
            window.open(`https://wa.me/?text=${msg}`, '_blank');
            App.closeModal();
            App.switchView('records');
        });

        document.getElementById('success-close-btn').addEventListener('click', () => {
            App.closeModal();
            App.switchView('records');
        });
    },

    showRecordDetails: (id) => {
        const record = App.allRecords.find(r => r.id === id);
        if (!record) return;

        const date = Utils.formatDate(record.flightDate);
        const malfHtml = record.malfunctions && record.malfunctions.length > 0 
            ? record.malfunctions.map(m => {
                const isCritical = m.severity === 'קריטי';
                const critIcon = isCritical ? '<i data-lucide="flag" class="color-critical" style="width:14px;height:14px;margin-left:4px;"></i>' : '';
                return `<li style="margin-bottom:5px; list-style:none; display:flex; align-items:center;">
                    ${critIcon}
                    <span>${m.type} <span style="opacity:0.7; font-size:0.85rem;">(${m.severity || 'לא צוין'})</span></span>
                </li>`;
            }).join('') 
            : '<li>אין תקלות</li>';

        const content = `
            <div class="detail-grid">
                <span class="detail-label">מספר זנב:</span><span class="detail-value">${record.droneTailNumber}</span>
                <span class="detail-label">יחידה:</span><span class="detail-value">${record.operatingUnit}</span>
                <span class="detail-label">תאריך:</span><span class="detail-value">${date}</span>
                <span class="detail-label">זמן המראה:</span><span class="detail-value">${record.takeoffTime}</span>
                <span class="detail-label">זמן נחיתה:</span><span class="detail-value">${record.landingTime}</span>
                <span class="detail-label">משך טיסה:</span><span class="detail-value">${record.totalFlightMinutes} דקות</span>
                <span class="detail-label">סיבת נחיתה:</span><span class="detail-value">${record.landingReason === 'initiated' ? 'יזומה 🟢' : 'בגלל תקלה 🔴'}</span>
            </div>
            <div class="detail-section">
                <h4 style="margin: 15px 0 5px; color: var(--text-secondary);">תקלות:</h4>
                <ul style="padding: 0; margin: 0; list-style: none;">${malfHtml}</ul>
            </div>
            <div class="detail-section">
                <h4 style="margin: 15px 0 5px; color: var(--text-secondary);">פירוט והערות:</h4>
                <p style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">${record.notes || 'אין הערות'}</p>
            </div>
        `;

        App.showModal(`פרטי טיסה: ${record.droneTailNumber}`, content);
    },

    showMalfunctionBreakdown: (data) => {
        const malfCounts = {};
        data.forEach(r => {
            if (r.malfunctions) {
                r.malfunctions.forEach(m => {
                    malfCounts[m.type] = (malfCounts[m.type] || 0) + 1;
                });
            } else if (r.landingReason === 'malfunction') {
                const type = r.malfunctionType || 'אחר';
                malfCounts[type] = (malfCounts[type] || 0) + 1;
            }
        });

        if (Object.keys(malfCounts).length === 0) {
            App.showModal('סיכום תקלות', '<p style="text-align:center; padding: 20px;">לא נמצאו תקלות בטווח שנבחר.</p>');
            return;
        }

        const listHtml = Object.entries(malfCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => `
                <div class="malf-summary-row">
                    <span>${type}</span>
                    <span class="malf-count">${count}</span>
                </div>
            `).join('');

        App.showModal('סיכום סוגי תקלות', `<div class="malf-summary-list">${listHtml}</div>`);
    },

    currentFilteredRecords: [],


    addMalfunctionRow: (initialType = '', initialSeverity = '') => {
        const list = document.getElementById('malfunctions-list');
        const div = document.createElement('div');
        div.className = 'malfunction-entry-row';
        
        // Malfunction Type Select
        const typeSelect = document.createElement('select');
        typeSelect.className = 'malf-type-select';
        typeSelect.innerHTML = '<option value="" disabled selected>סוג תקלה...</option>';
        App.malfunctionTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.innerText = t.name;
            if (t.name === initialType) opt.selected = true;
            typeSelect.appendChild(opt);
        });

        // Severity Select
        const sevSelect = document.createElement('select');
        sevSelect.className = 'malf-sev-select';
        sevSelect.innerHTML = '<option value="" disabled selected>חומרה...</option>';
        App.malfunctionSeverities.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.innerText = s.name;
            if (s.name === initialSeverity) opt.selected = true;
            sevSelect.appendChild(opt);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'icon-btn danger';
        removeBtn.innerHTML = '<i data-lucide="x-circle"></i>';
        removeBtn.onclick = () => div.remove();

        div.appendChild(typeSelect);
        div.appendChild(sevSelect);
        div.appendChild(removeBtn);
        list.appendChild(div);
        lucide.createIcons();
    },

    onLoginSuccess: async () => {
        // Clear previous listeners to avoid double-triggers
        App.unsubscribers.forEach(unsub => unsub());
        App.unsubscribers = [];

        // Start listeners
        const unsubUnits = Database.getUnits(units => {
            App.units = units;
            App.renderUnitsOnForm();
            App.renderAdminUnits();
        });
        App.unsubscribers.push(unsubUnits);

        const unsubMalf = Database.getMalfunctionTypes(types => {
            App.malfunctionTypes = types;
            App.renderAdminMalfunctionTypes();
        });
        App.unsubscribers.push(unsubMalf);

        const unsubSev = Database.getMalfunctionSeverities(severities => {
            App.malfunctionSeverities = severities;
            App.renderAdminSeverities();
        });
        App.unsubscribers.push(unsubSev);

        const unsubRecords = Database.getRecords(records => {
            App.allRecords = records;
            App.renderRecords();
            App.updateDashboard();
        });
        App.unsubscribers.push(unsubRecords);

        App.loadTailSuggestions();
        App.switchView('form');
    },

    switchView: (viewId) => {
        App.currentView = viewId;
        
        // Update UI
        document.querySelectorAll('.sub-view').forEach(v => v.classList.add('hidden'));
        document.getElementById(`${viewId}-view`).classList.remove('hidden');
        
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(btn => btn.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (activeNav) activeNav.classList.add('active');
        
        // Reset Form labels if not editing
        if (viewId === 'form' && !App.editingId) {
            document.getElementById('save-flight-btn').innerText = 'שמור טיסה';
            document.getElementById('cancel-edit-btn').classList.add('hidden');
        }

        // Update Title
        const titles = { 'form': 'רישום טיסה', 'dashboard': 'דשבורד', 'records': 'היסטוריית טיסות', 'admin': 'ניהול מערכת' };
        document.getElementById('page-title').innerText = titles[viewId] || '';
        
        if (viewId === 'dashboard') App.updateDashboard();
        lucide.createIcons();
    },

    // ... (rest of the render functions with malfunction support)
    renderAdminMalfunctionTypes: () => {
        const list = document.getElementById('malfunction-types-list');
        list.innerHTML = '';
        App.malfunctionTypes.forEach(t => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${t.name}</span>
                <button class="icon-btn danger" onclick="Database.deleteMalfunctionType('${t.id}')">
                    <i data-lucide="trash-2"></i>
                </button>
            `;
            list.appendChild(li);
        });
        lucide.createIcons();
    },

    renderAdminSeverities: () => {
        const list = document.getElementById('malfunction-severities-list');
        list.innerHTML = '';
        App.malfunctionSeverities.forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${s.name}</span>
                <button class="icon-btn danger" onclick="Database.deleteMalfunctionSeverity('${s.id}')">
                    <i data-lucide="trash-2"></i>
                </button>
            `;
            list.appendChild(li);
        });
        lucide.createIcons();
    },

    updateDashboard: () => {
        const dateFrom = document.getElementById('dash-date-from').value;
        const dateTo = document.getElementById('dash-date-to').value;
        const tailFilter = document.getElementById('dash-tail-filter');
        const selectedTail = tailFilter.value;
        
        // Populate Tail Filter if needed (but keep selection if it still exists)
        const uniqueTails = [...new Set(App.allRecords.map(r => r.droneTailNumber))].sort();
        const currentVal = tailFilter.value;
        tailFilter.innerHTML = '<option value="">כל כלי הטיס</option>';
        uniqueTails.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.innerText = t;
            if (t === currentVal) opt.selected = true;
            tailFilter.appendChild(opt);
        });

        let filtered = App.allRecords;
        if (dateFrom) filtered = filtered.filter(r => r.flightDate >= dateFrom);
        if (dateTo) filtered = filtered.filter(r => r.flightDate <= dateTo);
        if (selectedTail) filtered = filtered.filter(r => r.droneTailNumber === selectedTail);

        App.currentFilteredRecords = filtered;

        // Stats
        const totalMins = filtered.reduce((acc, r) => acc + (r.totalFlightMinutes || 0), 0);
        
        // Count all malfunctions in the array
        let totalMalfunctions = 0;
        filtered.forEach(r => {
            if (r.malfunctions) totalMalfunctions += r.malfunctions.length;
            else if (r.landingReason === 'malfunction') totalMalfunctions += 1;
        });

        document.getElementById('stat-total-hours').innerText = (totalMins / 60).toFixed(1);
        document.getElementById('stat-total-flights').innerText = filtered.length;
        document.getElementById('stat-malfunctions').innerText = totalMalfunctions;

        App.renderCharts(filtered);
    },

    renderCharts: (data) => {
        const ctxUnit = document.getElementById('unit-chart').getContext('2d');
        const ctxDrone = document.getElementById('drone-chart').getContext('2d');
        const ctxMalf = document.getElementById('malfunction-chart').getContext('2d');

        const unitData = {};
        const droneData = {};
        const malfData = {};

        data.forEach(r => {
            unitData[r.operatingUnit] = (unitData[r.operatingUnit] || 0) + (r.totalFlightMinutes / 60);
            droneData[r.droneTailNumber] = (droneData[r.droneTailNumber] || 0) + (r.totalFlightMinutes / 60);
            
            if (r.malfunctions) {
                r.malfunctions.forEach(m => {
                    malfData[m.type] = (malfData[m.type] || 0) + 1;
                });
            } else if (r.landingReason === 'malfunction') {
                const type = r.malfunctionType || 'אחר';
                malfData[type] = (malfData[type] || 0) + 1;
            }
        });

        if (App.charts.unit) App.charts.unit.destroy();
        if (App.charts.drone) App.charts.drone.destroy();
        if (App.charts.malf) App.charts.malf.destroy();

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: '#fff',
                    anchor: 'center',
                    align: 'center',
                    font: { weight: 'bold', size: 10 },
                    textAlign: 'center',
                    formatter: (val, context) => {
                        const label = context.chart.data.labels[context.dataIndex];
                        return `${label}\n${val.toFixed(1)}`;
                    },
                    textShadowBlur: 4,
                    textShadowColor: 'rgba(0,0,0,0.8)'
                }
            },
            scales: { 
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { display: false } }, 
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } } 
            }
        };

        const barPlugins = [ChartDataLabels];

        App.charts.unit = new Chart(ctxUnit, {
            type: 'bar',
            plugins: barPlugins,
            data: {
                labels: Object.keys(unitData),
                datasets: [{ label: 'שעות', data: Object.values(unitData), backgroundColor: '#3b82f6', borderRadius: 8 }]
            },
            options: commonOptions
        });

        App.charts.drone = new Chart(ctxDrone, {
            type: 'bar',
            plugins: barPlugins,
            data: {
                labels: Object.keys(droneData),
                datasets: [{ label: 'שעות', data: Object.values(droneData), backgroundColor: '#10b981', borderRadius: 8 }]
            },
            options: commonOptions
        });

        App.charts.malf = new Chart(ctxMalf, {
            type: 'pie',
            plugins: barPlugins,
            data: {
                labels: Object.keys(malfData),
                datasets: [{ data: Object.values(malfData), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'] }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                animation: { duration: 0 },
                plugins: { 
                    legend: { position: 'bottom', labels: { color: '#f8fafc', boxWidth: 12, padding: 10, font: { size: 11 } } },
                    datalabels: {
                        color: '#fff',
                        font: { weight: 'bold', size: 11 },
                        formatter: (val, context) => {
                            const label = context.chart.data.labels[context.dataIndex];
                            return `${label}\n${val}`;
                        },
                        anchor: 'center',
                        align: 'center',
                        textAlign: 'center',
                        textShadowBlur: 4,
                        textShadowColor: 'rgba(0,0,0,0.8)'
                    }
                } 
            }
        });
    },

    loadTailSuggestions: async () => {
        const suggestions = await syncEngine.getTailSuggestions();
        const dataList = document.getElementById('tail-suggestions');
        dataList.innerHTML = '';
        suggestions.sort((a,b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.tailNumber;
                dataList.appendChild(opt);
            });
    },

    renderUnitsOnForm: () => {
        const select = document.getElementById('operating-unit');
        const currentVal = select.value;
        select.innerHTML = '<option value="" disabled selected>בחר יחידה...</option>';
        App.units.forEach(u => {
            const opt = document.createElement('option');
            opt.value = u.name;
            opt.innerText = u.name;
            select.appendChild(opt);
        });
        select.value = currentVal;
    },

    renderAdminUnits: () => {
        const list = document.getElementById('units-list');
        list.innerHTML = '';
        App.units.forEach(u => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${u.name}</span>
                <button class="icon-btn danger" onclick="Database.deleteUnit('${u.id}')">
                    <i data-lucide="trash-2"></i>
                </button>
            `;
            list.appendChild(li);
        });
        lucide.createIcons();
    },

    editRecord: (id) => {
        const record = App.allRecords.find(r => r.id === id);
        if (!record) return;

        App.editingId = id;
        App.switchView('form');
        
        // UI Updates for Edit Mode
        document.getElementById('save-flight-btn').innerText = 'עדכן טיסה';
        document.getElementById('cancel-edit-btn').classList.remove('hidden');

        // Fill basic fields
        document.getElementById('operating-unit').value = record.operatingUnit;
        document.getElementById('tail-number').value = record.droneTailNumber;
        document.getElementById('flight-date').value = record.flightDate;
        document.getElementById('takeoff-time').value = record.takeoffTime;
        document.getElementById('landing-time').value = record.landingTime;
        
        // Radio buttons
        const radio = document.querySelector(`input[name="landing-reason"][value="${record.landingReason}"]`);
        if (radio) radio.checked = true;

        // Notes
        document.getElementById('general-notes').value = record.notes || '';

        // Malfunctions
        const list = document.getElementById('malfunctions-list');
        list.innerHTML = '';
        if (record.malfunctions) {
            record.malfunctions.forEach(m => {
                App.addMalfunctionRow(m.type, m.severity);
            });
        }

        // Recalculate duration display
        document.getElementById('calc-total-time').innerText = record.totalFlightMinutes || 0;
        
        Utils.showToast('עריכת רישום...', 'info');
    },

    renderRecords: (search = '') => {
        const list = document.getElementById('records-list');
        list.innerHTML = '';
        
        const dateFrom = document.getElementById('record-date-from').value;
        const dateTo = document.getElementById('record-date-to').value;
        const searchText = search || document.getElementById('record-search').value;

        let filtered = App.allRecords;

        if (searchText) {
            const lowSearch = searchText.toLowerCase();
            filtered = filtered.filter(r => 
                (r.operatingUnit && r.operatingUnit.toLowerCase().includes(lowSearch)) || 
                (r.droneTailNumber && r.droneTailNumber.toLowerCase().includes(lowSearch))
            );
        }

        if (dateFrom) filtered = filtered.filter(r => r.flightDate >= dateFrom);
        if (dateTo) filtered = filtered.filter(r => r.flightDate <= dateTo);

        // Sort by date/time (newest first)
        filtered.sort((a,b) => b.flightDate.localeCompare(a.flightDate) || b.takeoffTime.localeCompare(a.takeoffTime));

        // Store for export
        App.currentFilteredRecordsForExport = filtered;

        if (filtered.length === 0) {
            list.innerHTML = '<div class="placeholder-text">לא נמצאו רשומות</div>';
            return;
        }

        filtered.forEach(r => {
            const hasMalfunctions = (r.malfunctions && r.malfunctions.length > 0) || r.landingReason === 'malfunction';
            const hasCritical = r.malfunctions && r.malfunctions.some(m => m.severity === 'קריטי');
            
            const malfIcon = hasCritical ? '<i data-lucide="flag" class="color-critical"></i>' : (hasMalfunctions ? ' ⚠️' : '');
            
            const item = document.createElement('div');
            item.className = 'record-item';
            item.onclick = (e) => {
                if (e.target.closest('.record-actions')) return;
                App.showRecordDetails(r.id);
            };
            item.innerHTML = `
                <div class="record-info">
                    <span class="record-title">${r.droneTailNumber} (${r.operatingUnit})</span>
                    <span class="record-subtitle">${Utils.formatDate(r.flightDate)} | ${r.takeoffTime}-${r.landingTime} ${malfIcon}</span>
                </div>
                <div class="record-minutes">${r.totalFlightMinutes} דק'</div>
                <div class="record-actions">
                    <button class="icon-btn" onclick="App.editRecord('${r.id}')"><i data-lucide="edit-3"></i></button>
                    <button class="icon-btn danger" onclick="App.confirmDeleteRecord('${r.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            list.appendChild(item);
        });
        lucide.createIcons();
    },

    currentFilteredRecordsForExport: [],

    exportToCSV: () => {
        const data = App.currentFilteredRecordsForExport;
        if (!data || data.length === 0) {
            Utils.showToast('אין נתונים לייצוא', 'info');
            return;
        }

        const headers = ['תאריך', 'יחידה', 'מספר זנב', 'המראה', 'נחיתה', 'משך (דק)', 'סיבת נחיתה', 'תקלות', 'הערות'];
        const rows = data.map(r => [
            r.flightDate,
            r.operatingUnit,
            r.droneTailNumber,
            r.takeoffTime,
            r.landingTime,
            r.totalFlightMinutes,
            r.landingReason === 'initiated' ? 'יזומה' : 'תקלה',
            r.malfunctions ? r.malfunctions.map(m => `${m.type} (${m.severity || 'לא צוין'})`).join('; ') : '',
            (r.notes || '').replace(/\n/g, ' ')
        ]);

        const csvContent = [headers, ...rows]
            .map(e => e.join(","))
            .join("\n");

        // Use BOM for Hebrew support in Excel
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `sufa_flights_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        Utils.showToast('הקובץ יוצא בהצלחה', 'success');
    },

    confirmDeleteRecord: async (id) => {
        if (confirm('האם אתה בטוח שברצונך למחוק רשומה זו?')) {
            await Database.deleteRecord(id);
        }
    },
};

// Start the APP
window.addEventListener('DOMContentLoaded', () => App.init());
