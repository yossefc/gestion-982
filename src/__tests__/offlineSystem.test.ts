/**
 * Tests complets pour le système offline
 *
 * Ce fichier teste:
 * 1. CacheService - hydratation, persistence, TTL, invalidation
 * 2. OfflineService - queue, retry, sync
 * 3. Intégration complète du flux offline
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Les mocks sont configurés dans jest.setup.js
import {
  getCached,
  invalidateCache,
  invalidateAllCaches,
  updateCacheOptimistically,
  subscribeToCache,
  hydrateFromStorage,
  persistAllToStorage,
  clearStorage,
  getCacheStats,
  hasCachedData,
  getCachedDataImmediate,
  resetAllCacheData,
} from '../services/cacheService';

import {
  initOfflineService,
  queueOperation,
  processQueue,
  getOfflineState,
  isOnline,
  getPendingCount,
  getPendingOperations,
  getFailedOperations,
  clearAllQueues,
  setTransactionFunctions,
} from '../services/offlineService';

describe('CacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset cache state completely (data + timestamps)
    resetAllCacheData();
  });

  describe('Hydration from Storage', () => {
    it('should hydrate cache from AsyncStorage on startup', async () => {
      const mockData = {
        data: [
          { id: '1', name: 'Soldier 1', personalNumber: '12345' },
          { id: '2', name: 'Soldier 2', personalNumber: '67890' },
        ],
        timestamp: Date.now() - 1000, // 1 second ago
      };

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/cache/soldiers') {
          return Promise.resolve(JSON.stringify(mockData));
        }
        return Promise.resolve(null);
      });

      await hydrateFromStorage();

      // Verify data was loaded
      expect(hasCachedData('soldiers')).toBe(true);
      const soldiers = getCachedDataImmediate<{id: string; name: string}>('soldiers');
      expect(soldiers).toHaveLength(2);
      expect(soldiers[0].name).toBe('Soldier 1');
    });

    it('should reject expired storage data', async () => {
      const mockData = {
        data: [{ id: '1', name: 'Old Soldier' }],
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago (expired)
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockData));

      await hydrateFromStorage();

      // Data should not be loaded because it's too old
      expect(hasCachedData('soldiers')).toBe(false);
    });
  });

  describe('Cache Persistence', () => {
    it('should persist cache to AsyncStorage', async () => {
      // Manually set cache data
      updateCacheOptimistically('soldiers', 'add', {
        id: '1',
        name: 'Test Soldier',
        personalNumber: '12345',
      });

      await persistAllToStorage();

      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should clear storage on request', async () => {
      await clearStorage();

      expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate specific cache', async () => {
      // First hydrate with valid data to make cache valid
      const mockData = {
        data: [{ id: '1', name: 'Soldier', personalNumber: '12345' }],
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/cache/soldiers') {
          return Promise.resolve(JSON.stringify(mockData));
        }
        return Promise.resolve(null);
      });

      await hydrateFromStorage();

      const statsBefore = getCacheStats();
      expect(statsBefore.soldiers.valid).toBe(true);

      invalidateCache('soldiers');

      const statsAfter = getCacheStats();
      expect(statsAfter.soldiers.valid).toBe(false);
    });

    it('should invalidate all caches', () => {
      updateCacheOptimistically('soldiers', 'add', { id: '1', name: 'S1' });
      updateCacheOptimistically('combatEquipment', 'add', { id: '1', name: 'E1' });

      invalidateAllCaches();

      const stats = getCacheStats();
      expect(stats.soldiers.valid).toBe(false);
      expect(stats.combatEquipment.valid).toBe(false);
    });
  });

  describe('Optimistic Updates', () => {
    it('should add item optimistically', () => {
      const newSoldier = { id: '1', name: 'New Soldier', personalNumber: '11111' };

      updateCacheOptimistically('soldiers', 'add', newSoldier);

      const soldiers = getCachedDataImmediate('soldiers');
      expect(soldiers).toContainEqual(expect.objectContaining({ id: '1' }));
    });

    it('should update item optimistically', () => {
      updateCacheOptimistically('soldiers', 'add', { id: '1', name: 'Original' });
      updateCacheOptimistically('soldiers', 'update', { id: '1', name: 'Updated' });

      const soldiers = getCachedDataImmediate<{id: string; name: string}>('soldiers');
      const soldier = soldiers.find((s) => s.id === '1');
      expect(soldier?.name).toBe('Updated');
    });

    it('should delete item optimistically', () => {
      updateCacheOptimistically('soldiers', 'add', { id: '1', name: 'ToDelete' });
      updateCacheOptimistically('soldiers', 'add', { id: '2', name: 'ToKeep' });

      updateCacheOptimistically('soldiers', 'delete', { id: '1' });

      const soldiers = getCachedDataImmediate<{id: string; name: string}>('soldiers');
      expect(soldiers).toHaveLength(1);
      expect(soldiers[0].id).toBe('2');
    });
  });

  describe('Subscription System', () => {
    it('should notify subscribers on cache update', () => {
      const callback = jest.fn();
      const unsubscribe = subscribeToCache('soldiers', callback);

      updateCacheOptimistically('soldiers', 'add', { id: '1', name: 'Test' });

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ id: '1' })
      ]));

      unsubscribe();
    });

    it('should stop notifications after unsubscribe', () => {
      const callback = jest.fn();
      const unsubscribe = subscribeToCache('soldiers', callback);

      unsubscribe();
      callback.mockClear();

      updateCacheOptimistically('soldiers', 'add', { id: '2', name: 'Test2' });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('OfflineService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    await clearAllQueues();
  });

  describe('Queue Operations', () => {
    it('should queue operation when offline', async () => {
      const localId = await queueOperation('issue', {
        soldierId: 'soldier-1',
        items: [{ equipmentId: 'eq-1', quantity: 1 }],
        requestId: 'req-123',
      });

      expect(localId).toContain('LOCAL_');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should maintain operation order in queue', async () => {
      // Track the accumulated queue
      let storedQueue: any[] = [];

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve(JSON.stringify(storedQueue));
        }
        return Promise.resolve(null);
      });

      (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          storedQueue = JSON.parse(value);
        }
        return Promise.resolve();
      });

      await queueOperation('issue', { soldierId: '1', requestId: 'a' });
      await queueOperation('return', { soldierId: '2', requestId: 'b' });
      await queueOperation('credit', { soldierId: '3', requestId: 'c' });

      expect(storedQueue).toHaveLength(3);
      expect(storedQueue[0].type).toBe('issue');
      expect(storedQueue[1].type).toBe('return');
      expect(storedQueue[2].type).toBe('credit');
    });
  });

  describe('Process Queue', () => {
    it('should process queue when online', async () => {
      // Setup: mock queue with one operation
      const mockQueue = [{
        id: 'op-1',
        type: 'issue',
        params: { soldierId: '1', items: [] },
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
      }];

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve(JSON.stringify(mockQueue));
        }
        return Promise.resolve(null);
      });

      // Mock transaction function
      const mockIssue = jest.fn().mockResolvedValue('firebase-id-123');
      setTransactionFunctions({
        issue: mockIssue,
        return: jest.fn(),
        add: jest.fn(),
        credit: jest.fn(),
        storage: jest.fn(),
        retrieve: jest.fn(),
      });

      await initOfflineService();
      const result = await processQueue();

      expect(mockIssue).toHaveBeenCalled();
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should retry failed operations up to 3 times', async () => {
      const mockQueue = [{
        id: 'op-fail',
        type: 'issue',
        params: { soldierId: '1' },
        timestamp: Date.now(),
        retryCount: 2, // Already retried twice
        status: 'pending',
      }];

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve(JSON.stringify(mockQueue));
        }
        if (key === '@gestion982/offline/failedQueue') {
          return Promise.resolve('[]');
        }
        return Promise.resolve(null);
      });

      // Mock failing transaction
      const mockIssue = jest.fn().mockRejectedValue(new Error('Network error'));
      setTransactionFunctions({
        issue: mockIssue,
        return: jest.fn(),
        add: jest.fn(),
        credit: jest.fn(),
        storage: jest.fn(),
        retrieve: jest.fn(),
      });

      await initOfflineService();
      const result = await processQueue();

      expect(result.failed).toBe(1);

      // Verify operation moved to failed queue (retryCount >= 3)
      const failedQueueCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === '@gestion982/offline/failedQueue'
      );
      expect(failedQueueCall).toBeDefined();
    });

    it('should not process when already syncing', async () => {
      const mockQueue = [{
        id: 'op-1',
        type: 'issue',
        params: {},
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending',
      }];

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockQueue));

      // Start first process (don't await)
      const slowFn = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      setTransactionFunctions({
        issue: slowFn,
        return: jest.fn(),
        add: jest.fn(),
        credit: jest.fn(),
        storage: jest.fn(),
        retrieve: jest.fn(),
      });

      await initOfflineService();

      // Start processing
      const process1 = processQueue();

      // Try to start another process immediately
      const result2 = await processQueue();

      // Second call should be skipped
      expect(result2.success).toBe(0);
      expect(result2.failed).toBe(0);

      await process1;
    });
  });

  describe('Offline State', () => {
    it('should report correct offline state', async () => {
      await initOfflineService();

      const state = getOfflineState();

      expect(state).toHaveProperty('isOnline');
      expect(state).toHaveProperty('pendingCount');
      expect(state).toHaveProperty('failedCount');
      expect(state).toHaveProperty('syncStatus');
    });

    it('should track pending count correctly', async () => {
      // Track the accumulated queue
      let storedQueue: any[] = [];

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve(JSON.stringify(storedQueue));
        }
        return Promise.resolve(null);
      });

      (AsyncStorage.setItem as jest.Mock).mockImplementation((key: string, value: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          storedQueue = JSON.parse(value);
        }
        return Promise.resolve();
      });

      await queueOperation('issue', { soldierId: '1' });
      await queueOperation('return', { soldierId: '2' });

      const count = getPendingCount();
      expect(count).toBe(2);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    resetAllCacheData();
    await clearAllQueues();
  });

  describe('Full Offline Flow', () => {
    it('should handle complete offline -> online cycle', async () => {
      // 1. Setup: User has cached data
      const cachedSoldiers = {
        data: [{ id: 's1', name: 'Cached Soldier' }],
        timestamp: Date.now(),
      };

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/cache/soldiers') {
          return Promise.resolve(JSON.stringify(cachedSoldiers));
        }
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve('[]');
        }
        return Promise.resolve(null);
      });

      // 2. Hydrate cache (simulating app start)
      await hydrateFromStorage();
      expect(hasCachedData('soldiers')).toBe(true);

      // 3. User makes an offline operation
      const localId = await queueOperation('issue', {
        soldierId: 's1',
        items: [{ equipmentId: 'eq1', quantity: 1 }],
        requestId: 'offline-op-1',
      });
      expect(localId).toBeDefined();

      // 4. Optimistic update to cache
      updateCacheOptimistically('combatAssignments', 'add', {
        id: localId,
        soldierId: 's1',
        status: 'pending',
      });

      // 5. Verify optimistic update
      const assignments = getCachedDataImmediate('combatAssignments');
      expect(assignments).toContainEqual(expect.objectContaining({ id: localId }));

      // 6. Simulate coming back online - process queue
      const mockIssueFn = jest.fn().mockResolvedValue('firebase-id-real');
      setTransactionFunctions({
        issue: mockIssueFn,
        return: jest.fn(),
        add: jest.fn(),
        credit: jest.fn(),
        storage: jest.fn(),
        retrieve: jest.fn(),
      });

      // Update mock to return queued operation
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve(JSON.stringify([{
            id: 'op-1',
            type: 'issue',
            params: { soldierId: 's1', items: [], requestId: 'offline-op-1' },
            timestamp: Date.now(),
            retryCount: 0,
            status: 'pending',
            localResult: localId,
          }]));
        }
        if (key === '@gestion982/offline/failedQueue') {
          return Promise.resolve('[]');
        }
        return Promise.resolve(null);
      });

      await initOfflineService();
      const result = await processQueue();

      // 7. Verify sync completed
      expect(result.success).toBe(1);
      expect(mockIssueFn).toHaveBeenCalled();
    });

    it('should preserve data across app restarts', async () => {
      // First session: add data and persist
      updateCacheOptimistically('soldiers', 'add', {
        id: 'persistent-1',
        name: 'Persistent Soldier',
        personalNumber: '99999',
      });

      await persistAllToStorage();

      // Verify setItem was called with correct data
      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === '@gestion982/cache/soldiers'
      );
      expect(setItemCall).toBeDefined();

      const savedData = JSON.parse(setItemCall[1]);
      expect(savedData.data).toContainEqual(
        expect.objectContaining({ id: 'persistent-1' })
      );
    });
  });

  describe('Error Recovery', () => {
    it('should recover from partial sync failure', async () => {
      const mockQueue = [
        { id: 'op-1', type: 'issue', params: { id: '1' }, timestamp: Date.now(), retryCount: 0, status: 'pending' },
        { id: 'op-2', type: 'issue', params: { id: '2' }, timestamp: Date.now(), retryCount: 0, status: 'pending' },
        { id: 'op-3', type: 'issue', params: { id: '3' }, timestamp: Date.now(), retryCount: 0, status: 'pending' },
      ];

      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === '@gestion982/offline/pendingQueue') {
          return Promise.resolve(JSON.stringify(mockQueue));
        }
        if (key === '@gestion982/offline/failedQueue') {
          return Promise.resolve('[]');
        }
        return Promise.resolve(null);
      });

      // First and third succeed, second fails
      let callCount = 0;
      const mockIssue = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(`success-${callCount}`);
      });

      setTransactionFunctions({
        issue: mockIssue,
        return: jest.fn(),
        add: jest.fn(),
        credit: jest.fn(),
        storage: jest.fn(),
        retrieve: jest.fn(),
      });

      await initOfflineService();
      const result = await processQueue();

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
    });
  });
});

// Run tests
console.log('Running Offline System Tests...');
