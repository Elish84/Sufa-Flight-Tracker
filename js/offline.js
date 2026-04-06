// Offline Synchronization Logic (IndexedDB Engine)
/**
 * Using 'idb' library for easy IndexedDB management.
 * This class handles the local queue and auto-sync when online.
 */

class OfflineSync {
    constructor() {
        this.dbName = 'sufa-flight-tracker';
        this.storeName = 'submissions-queue';
        this.db = null;
        this.isSyncing = false;
        
        this.init();
        this.registerOnlineListener();
    }

    async init() {
        this.db = await idb.openDB(this.dbName, 1, {
            upgrade(db) {
                db.createObjectStore('submissions-queue', { keyPath: 'id' });
                db.createObjectStore('tail-suggestions', { keyPath: 'tailNumber' });
            },
        });
        
        // Initial sync check
        if (navigator.onLine) {
            this.syncQueue();
        }
    }

    /**
     * Add a flight record to the local queue if offline or as a temporary buffer.
     * @param {Object} data 
     */
    async addToQueue(data) {
        data.status = 'pending';
        data.queuedAt = new Date().toISOString();
        await this.db.put(this.storeName, data);
        
        // Save tail number suggestion locally
        await this.db.put('tail-suggestions', { tailNumber: data.droneTailNumber, lastUsed: new Date().toISOString() });
        
        if (navigator.onLine) {
            this.syncQueue();
        } else {
            document.getElementById('sync-notice').classList.remove('hidden');
        }
    }

    /**
     * Sync the local queue to Firestore.
     */
    async syncQueue() {
        if (this.isSyncing || !navigator.onLine) return;
        
        const allItems = await this.db.getAll(this.storeName);
        if (allItems.length === 0) {
            document.getElementById('sync-notice').classList.add('hidden');
            return;
        }

        this.isSyncing = true;
        
        try {
            for (const item of allItems) {
                // Use stable ID for idempotent sync (doc(db, col, item.id))
                await db.collection('flightLogs').doc(item.id).set({
                    ...item,
                    status: 'synced',
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                // Remove from queue after successful sync
                await this.db.delete(this.storeName, item.id);
            }
            
            Utils.showToast(`${allItems.length} טיסות סונכרנו בהצלחה`, 'success');
            document.getElementById('sync-notice').classList.add('hidden');
        } catch (error) {
            console.error('Sync failed:', error);
            Utils.showToast('סנכרון נכשל, ננסה שוב מאוחר יותר', 'warning');
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Get suggestions for tail numbers from local memory.
     */
    async getTailSuggestions() {
        return await this.db.getAll('tail-suggestions');
    }

    registerOnlineListener() {
        window.addEventListener('online', () => {
            document.getElementById('sync-status').classList.replace('offline', 'online');
            this.syncQueue();
        });
        
        window.addEventListener('offline', () => {
            document.getElementById('sync-status').classList.replace('online', 'offline');
            document.getElementById('sync-notice').classList.remove('hidden');
        });
    }
}

const syncEngine = new OfflineSync();
