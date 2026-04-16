// src/hooks/useAutoFeedingTasks.js
// Replaces: the useAutoFeedingTasks() function that lived inline just
// above TaskManager in index.html (§TaskManager helper block).

import { useEffect } from 'react';
import { toDay } from '../lib/utils';
import { fsSet } from '../lib/firestore';

/**
 * Automatically creates two "feeding reminder" tasks per worker per day
 * (07:00 AM and 18:00 PM slots) and marks them done when the worker
 * submits a feed log entry for that day.
 *
 * Called inside TaskManager — no other consumer needed.
 */
export function useAutoFeedingTasks(tasks, setTasks, users, feeds) {
  useEffect(() => {
    const workers = users.filter(u => u.role === 'worker' && u.approved);
    if (workers.length === 0) return;

    const today = toDay();
    let changed = false;
    const updated = [...tasks];

    workers.forEach(w => {
      ['AM', 'PM'].forEach(slot => {
        const taskId = `autoFeed_${w.uid || w.id}_${today}_${slot}`;
        const exists = updated.find(t => t.id === taskId);
        const title = slot === 'AM'
          ? '🌅 Morning Feeding (07:00)'
          : '🌆 Evening Feeding (18:00)';
        const desc = slot === 'AM'
          ? 'Feed all pigs by 7:00 AM and log the feeding entry.'
          : 'Feed all pigs by 6:00 PM and log the feeding entry.';

        const fedToday = feeds.some(
          f => f.workerId === (w.uid || w.id) && f.date === today
        );

        if (!exists) {
          updated.push({
            id: taskId, title, desc,
            workerId: w.uid || w.id,
            priority: 'High', due: today,
            createdBy: '🤖 AI Auto-Task', createdAt: today,
            status: fedToday ? 'done' : 'pending',
            autoFeed: true, slot,
          });
          changed = true;
        } else if (exists.status === 'pending' && fedToday) {
          const idx = updated.findIndex(t => t.id === taskId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              status: 'done',
              autoCompletedAt: new Date().toISOString(),
            };
            changed = true;
          }
        }
      });
    });

    if (changed) {
      setTasks(updated);
      fsSet('tasks', updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, feeds, tasks.length]);
}
