import { useEffect, useMemo, useState } from "react";

const storeKey = (uid) => `farmiq_seen_${uid}`;

export function useNewBadges(user, datasets, activePage) {
  const [seen, setSeen] = useState(() => {
    const saved = JSON.parse(localStorage.getItem(storeKey(user?.uid)) || "{}");
    for (const tab of Object.keys(datasets)) if (!saved[tab]) saved[tab] = Date.now();
    return saved;
  });

  useEffect(() => {
    localStorage.setItem(storeKey(user?.uid), JSON.stringify(seen));
  }, [seen, user?.uid]);

  const markSeen = (tab) => setSeen((s) => ({ ...s, [tab]: Date.now() }));

  const counts = useMemo(() => {
    const out = {};
    for (const [tab, rows] of Object.entries(datasets)) {
      out[tab] = (rows || []).filter((r) => {
        const t = new Date(r.updatedAt || r.createdAt || r.date).getTime();
        const by = r.updatedBy || r.createdBy;
        return t > (seen[tab] || 0) && by && by !== user?.name;
      }).length;
    }
    return out;
  }, [datasets, seen, user?.name]);

  useEffect(() => {
    if (activePage && counts[activePage] > 0) markSeen(activePage);
  }, [activePage, counts]);

  return { counts, markSeen };
}
