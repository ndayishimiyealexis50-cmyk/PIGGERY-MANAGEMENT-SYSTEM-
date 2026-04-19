import React, { useState, useEffect } from "react";
import { fsSet } from "../lib/firestore";

const CATEGORIES = [
  { id: "live_pig", label: "🐷 Live Pig (per kg)" },
  { id: "pork", label: "🥩 Pork Meat (per kg)" },
  { id: "piglet", label: "🐖 Piglet (each)" },
  { id: "feed_maize", label: "🌽 Maize Bran (per kg)" },
  { id: "feed_soya", label: "🌱 Soya (per kg)" },
];

export default function RWMarket({ allData, user, isAdmin }) {
  const surveys = allData?.marketSurveys || [];
  const [form, setForm] = useState({ category: "live_pig", price: "", market: "", note: "" });
  const [saving, setSaving] = useState(false);

  const latest = {};
  [...surveys].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(s => {
    if (!latest[s.category]) latest[s.category] = s;
  });

  async function submit() {
    if (!form.price || !form.market) return alert("Fill price and market name");
    setSaving(true);
    const entry = { ...form, price: Number(form.price), date: new Date().toISOString(), reporter: user?.name || user?.email, uid: user?.uid };
    const updated = [...surveys, entry];
    await fsSet("marketSurveys", updated);
    setForm({ category: "live_pig", price: "", market: "", note: "" });
    setSaving(false);
  }

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📊 RW Pig Market</div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>Community-sourced Rwanda market prices</div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📈 Latest Prices</div>
        {CATEGORIES.map(c => {
          const s = latest[c.id];
          return (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: 13 }}>{c.label}</span>
              <span style={{ fontWeight: 700, color: s ? "#16a34a" : "#999" }}>
                {s ? `RWF ${s.price.toLocaleString()}` : "No data"}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>📝 Submit Price</div>
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", marginBottom: 8 }}>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input type="number" placeholder="Price (RWF)" value={form.price}
          onChange={e => setForm({ ...form, price: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", marginBottom: 8, boxSizing: "border-box" }} />
        <input type="text" placeholder="Market name (e.g. Kimironko)" value={form.market}
          onChange={e => setForm({ ...form, market: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", marginBottom: 8, boxSizing: "border-box" }} />
        <input type="text" placeholder="Note (optional)" value={form.note}
          onChange={e => setForm({ ...form, note: e.target.value })}
          style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #ddd", marginBottom: 10, boxSizing: "border-box" }} />
        <button onClick={submit} disabled={saving}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          {saving ? "Saving..." : "Submit Price"}
        </button>
      </div>

      {surveys.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 14, marginTop: 16, boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>🕒 Recent Submissions</div>
          {[...surveys].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10).map((s, i) => (
            <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0", fontSize: 13 }}>
              <b>{CATEGORIES.find(c => c.id === s.category)?.label || s.category}</b>: RWF {s.price.toLocaleString()} @ {s.market}
              <span style={{ color: "#999", fontSize: 11, marginLeft: 6 }}>{new Date(s.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
