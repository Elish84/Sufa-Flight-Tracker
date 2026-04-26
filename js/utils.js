// Utility functions for Sufa Flight Tracker

const Utils = {
    // Generate a stable UUID for offline records
    generateId: () => {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    },

    // Calculate difference between two times in minutes
    calculateMinutes: (takeoff, landing) => {
        if (!takeoff || !landing) return 0;
        
        const [h1, m1] = takeoff.split(':').map(Number);
        const [h2, m2] = landing.split(':').map(Number);
        
        let start = h1 * 60 + m1;
        let end = h2 * 60 + m2;
        
        // Handle flight crossing midnight
        if (end < start) {
            end += 24 * 60;
        }
        
        return end - start;
    },

    // Format minutes to HH:mm string for display
    formatDuration: (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    },

    // Show a temporary toast message
    showToast: (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'alert-circle';
        if (type === 'warning') icon = 'alert-triangle';

        toast.innerHTML = `<i data-lucide="${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);
        lucide.createIcons();

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Format date to local string
    formatDate: (dateStr) => {
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        return new Date(dateStr).toLocaleDateString('he-IL', options);
    },

    // Format flight record for WhatsApp share
    formatWhatsAppMessage: (record) => {
        const date = Utils.formatDate(record.flightDate);
        const reason = record.landingReason === 'initiated' ? 'יזומה 🟢' : 'בגלל תקלה 🔴';
        const operatorText = record.operatorName ? `👤 *מטיס:* ${record.operatorName}\n` : '';
        
        let malfText = '';
        if (record.malfunctions && record.malfunctions.length > 0) {
            malfText = '\n⚠️ *תקלות:* ' + record.malfunctions.map(m => `${m.type} (${m.severity || 'לא צוין'})`).join(', ');
        }

        const notesText = record.notes ? `\n📝 *הערות:* ${record.notes}` : '';

        return encodeURIComponent(
            `🚀 *דיווח טיסה חדש - סופה*\n\n` +
            `📅 *תאריך:* ${date}\n` +
            `🚁 *מספר זנב:* ${record.droneTailNumber}\n` +
            `${operatorText}` +
            `👥 *יחידה:* ${record.operatingUnit}\n` +
            `⏱️ *זמן:* ${record.takeoffTime} - ${record.landingTime} (${Utils.formatDuration(record.totalFlightMinutes)} ש')\n` +
            `🛬 *נחיתה:* ${reason}` +
            `${malfText}` +
            `${notesText}\n\n` +
            `_נשלח ממערכת סופה_ 🦅`
        );
    }
};
