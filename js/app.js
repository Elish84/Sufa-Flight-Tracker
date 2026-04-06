// Main Application Controller for Sufa Flight Tracker

const App = {
    currentView: 'form',
    allRecords: [],
    units: [],
    malfunctionTypes: [],
    charts: {},
    isInitialized: false, // Prevent double-init
    unsubscribers: [], // Track Firestore listeners

    init: () => {
        if (App.isInitialized) return;
        App.isInitialized = true;

        // Initialize Auth
        Auth.init();
        
        // Navigation Logic - Only once
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                App.switchView(view);
            });
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

        // Flight Form Submission
        document.getElementById('flight-log-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const malfEntries = [];
            document.querySelectorAll('.malfunction-entry select').forEach(s => {
                if (s.value) malfEntries.push({ type: s.value });
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
                await Database.saveFlightRecord(formData);
                Utils.showToast('טיסה נשמרה בהצלחה', 'success');
                e.target.reset();
                calcDisplay.innerText = '0';
                document.getElementById('malfunctions-list').innerHTML = '';
                App.loadTailSuggestions();
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

        // Records Search
        document.getElementById('record-search').addEventListener('input', (e) => {
            App.renderRecords(e.target.value);
        });

        // Date & Tail Filters for Dashboard
        document.getElementById('dash-date-from').addEventListener('change', () => App.updateDashboard());
        document.getElementById('dash-date-to').addEventListener('change', () => App.updateDashboard());
        document.getElementById('dash-tail-filter').addEventListener('change', () => App.updateDashboard());
    },

    addMalfunctionRow: (initialValue = '') => {
        const list = document.getElementById('malfunctions-list');
        const div = document.createElement('div');
        div.className = 'malfunction-entry';
        
        const select = document.createElement('select');
        select.innerHTML = '<option value="" disabled selected>סוג תקלה...</option>';
        App.malfunctionTypes.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.innerText = t.name;
            if (t.name === initialValue) opt.selected = true;
            select.appendChild(opt);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'icon-btn danger';
        removeBtn.innerHTML = '<i data-lucide="x-circle"></i>';
        removeBtn.onclick = () => div.remove();

        div.appendChild(select);
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
        
        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`.nav-item[data-view="${viewId}"]`).classList.add('active');
        
        // Update Title
        const titles = { 'form': 'רישום טיסה', 'dashboard': 'דשבורד', 'records': 'היסטוריית טיסות', 'admin': 'ניהול מערכת' };
        document.getElementById('page-title').innerText = titles[viewId];
        
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
            
            // Collect malfunction types from array
            if (r.malfunctions) {
                r.malfunctions.forEach(m => {
                    malfData[m.type] = (malfData[m.type] || 0) + 1;
                });
            } else if (r.landingReason === 'malfunction') {
                const type = r.malfunctionType || 'אחר';
                malfData[type] = (malfData[type] || 0) + 1;
            }
        });

        // Stability: Clear containers and redraw
        if (App.charts.unit) App.charts.unit.destroy();
        if (App.charts.drone) App.charts.drone.destroy();
        if (App.charts.malf) App.charts.malf.destroy();

        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 }, // Disable animations to prevent resize loops
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#334155' } }, x: { grid: { display: false } } }
        };

        App.charts.unit = new Chart(ctxUnit, {
            type: 'bar',
            data: {
                labels: Object.keys(unitData),
                datasets: [{ label: 'שעות', data: Object.values(unitData), backgroundColor: '#3b82f6', borderRadius: 8 }]
            },
            options: commonOptions
        });

        App.charts.drone = new Chart(ctxDrone, {
            type: 'bar',
            data: {
                labels: Object.keys(droneData),
                datasets: [{ label: 'שעות', data: Object.values(droneData), backgroundColor: '#10b981', borderRadius: 8 }]
            },
            options: commonOptions
        });

        App.charts.malf = new Chart(ctxMalf, {
            type: 'pie',
            data: {
                labels: Object.keys(malfData),
                datasets: [{ data: Object.values(malfData), backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'] }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                animation: { duration: 0 },
                plugins: { legend: { position: 'bottom', labels: { color: '#f8fafc' } } } 
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

    renderRecords: (search = '') => {
        const list = document.getElementById('records-list');
        list.innerHTML = '';
        
        const filtered = App.allRecords.filter(r => 
            (r.operatingUnit && r.operatingUnit.includes(search)) || 
            (r.droneTailNumber && r.droneTailNumber.includes(search))
        );

        if (filtered.length === 0) {
            list.innerHTML = '<div class="placeholder-text">לא נמצאו רשומות</div>';
            return;
        }

        filtered.forEach(r => {
            const malfIcon = (r.malfunctions && r.malfunctions.length > 0) || r.landingReason === 'malfunction' ? ' ⚠️' : '';
            const item = document.createElement('div');
            item.className = 'record-item';
            item.innerHTML = `
                <div class="record-info">
                    <span class="record-title">${r.droneTailNumber} (${r.operatingUnit})</span>
                    <span class="record-subtitle">${Utils.formatDate(r.flightDate)} | ${r.takeoffTime}-${r.landingTime}${malfIcon}</span>
                </div>
                <div class="record-minutes">${r.totalFlightMinutes} דק'</div>
                <div class="record-actions">
                    <button class="icon-btn danger" onclick="App.confirmDeleteRecord('${r.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            `;
            list.appendChild(item);
        });
        lucide.createIcons();
    },

    confirmDeleteRecord: async (id) => {
        if (confirm('האם אתה בטוח שברצונך למחוק רשומה זו?')) {
            await Database.deleteRecord(id);
        }
    },
};

// Start the APP
window.addEventListener('DOMContentLoaded', () => App.init());


// Start the APP
window.addEventListener('DOMContentLoaded', () => App.init());
