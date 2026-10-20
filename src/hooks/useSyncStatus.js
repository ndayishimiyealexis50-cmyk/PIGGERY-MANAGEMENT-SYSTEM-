// src/hooks/useSyncStatus.js
// Replaces: §6a SYNC STATUS HOOK in index.html

import { useState, useEffect } from 'react';
import { _offlineStatus, _syncListeners } from '../lib/firestore';

/**
 * Returns live sync status: { online, queueLen, syncing, lastSync }
 * Subscribes to Firestore write events and online/offline transitions.
 */
export function useSyncStatus() {
  const [status, setStatus] = useState({ ..._offlineStatus });

  useEffect(() => {
    _syncListeners.add(setStatus);
    return () => _syncListeners.delete(setStatus);
  }, []);

  return status;
}
