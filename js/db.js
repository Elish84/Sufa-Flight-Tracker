// Firestore Repository Layer for Sufa Flight Tracker

const Database = {
    // Add a new flight log
    saveFlightRecord: async (record) => {
        const id = Utils.generateId();
        const fullRecord = {
            id,
            ...record,
            createdAt: new Date().toISOString(),
            createdBy: Auth.user?.email || 'unknown',
            totalFlightMinutes: Utils.calculateMinutes(record.takeoffTime, record.landingTime)
        };

        // Add to offline queue/syncer
        await syncEngine.addToQueue(fullRecord);
        
        // Immediate local feedback
        return fullRecord;
    },

    // Get all records (with listener for real-time updates)
    getRecords: (callback) => {
        return db.collection('flightLogs')
            .orderBy('flightDate', 'desc')
            .onSnapshot(snapshot => {
                const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(records);
            }, err => {
                console.error('Error fetching records:', err);
                // Return empty if blocked by permissions
                callback([]);
            });
    },

    // Delete a record
    deleteRecord: async (id) => {
        try {
            await db.collection('flightLogs').doc(id).delete();
            Utils.showToast('רישום נמחק בהצלחה', 'success');
        } catch (error) {
            console.error('Error deleting record:', error);
            Utils.showToast('שגיאה במחיקת רישום', 'error');
        }
    },

    // Units management
    getUnits: (callback) => {
        return db.collection('units').onSnapshot(snapshot => {
            const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(units);
        });
    },

    addUnit: async (name) => {
        try {
            await db.collection('units').add({ name });
            Utils.showToast('יחידה נוספה בהצלחה', 'success');
        } catch (error) {
            console.error('Error adding unit:', error);
            Utils.showToast('רק מנהל יכול להוסיף יחידות', 'error');
        }
    },

    deleteUnit: async (id) => {
        try {
            await db.collection('units').doc(id).delete();
            Utils.showToast('יחידה נמחקה', 'success');
        } catch (error) {
            Utils.showToast('רק מנהל יכול למחוק יחידות', 'error');
        }
    },

    // Malfunction Types management
    getMalfunctionTypes: (callback) => {
        return db.collection('malfunctionTypes').orderBy('name').onSnapshot(snapshot => {
            const types = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(types);
        });
    },

    addMalfunctionType: async (name) => {
        try {
            await db.collection('malfunctionTypes').add({ name });
            Utils.showToast('סוג תקלה נוסף בהצלחה', 'success');
        } catch (error) {
            Utils.showToast('רק מנהל יכול להוסיף סוגי תקלות', 'error');
        }
    },

    deleteMalfunctionType: async (id) => {
        try {
            await db.collection('malfunctionTypes').doc(id).delete();
            Utils.showToast('סוג תקלה נמחק', 'success');
        } catch (error) {
            Utils.showToast('רק מנהל יכול למחוק סוגי תקלות', 'error');
        }
    },

    // Check if current user is admin
    checkIfAdmin: async () => {
        if (!auth.currentUser) return false;
        console.log("Current User UID:", auth.currentUser.uid);
        try {
            const doc = await db.collection('admins').doc(auth.currentUser.uid).get();
            console.log("Admin doc exists?", doc.exists);
            return doc.exists;
        } catch (error) {
            console.error('Admin check failed:', error);
            return false;
        }
    }
};
