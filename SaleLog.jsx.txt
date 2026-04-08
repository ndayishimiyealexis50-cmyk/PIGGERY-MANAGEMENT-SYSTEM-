import { useState } from "react";
import { isAdminUser, fsSet, fmtRWF, C, S } from "../utils";
import AIPrediction from "./AIPrediction";
import PDFBtn from "./PDFBtn";

export default function SaleLog({ sales, setSales, pigs, feeds, logs, expenses, incomes, allData, user }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const isAdmin = isAdminUser(user);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div>
          <div style={S.h1}>💰 Sales Records</div>
          <div style={S.sub}>{sales.length} sales · {fmtRWF(sales.reduce((s, l) => s + (l.total || 0), 0))}</div>
        </div>
        <PDFBtn label="Finance PDF" type="finance" getData={() => allData} icon="🏷️" color="#374151" />
      </div>

      <div style={S.card}>
        {sales.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No sales yet.</div>}
        {sales.slice().reverse().map((s, i) => {
          const pig = pigs.find(p => p.id === s.pigId);
          return (
            <div key={i} style={{ ...S.row, flexWrap: "wrap", alignItems: "flex-start", gap: 4, paddingBottom: 8, marginBottom: 8, borderBottom: "1px solid " + C.elevated }}>
              {editId === s.id && editForm ? (
                <div style={{ width: "100%" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div><label style={S.lbl}>Buyer</label><input value={editForm.buyer} onChange={e => setEditForm({ ...editForm, buyer: e.target.value })} style={S.inp} /></div>
                    <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={editForm.weight} onChange={e => setEditForm({ ...editForm, weight: e.target.value })} style={S.inp} /></div>
                    <div><label style={S.lbl}>Price/kg (RWF)</label><input type="number" value={editForm.priceKg} onChange={e => setEditForm({ ...editForm, priceKg: e.target.value })} style={S.inp} /></div>
                    <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={S.inp} /></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => {
                      setSales(p => p.map(x => {
                        if (x.id !== s.id) return x;
                        const w = parseFloat(editForm.weight || x.weight) || x.weight;
                        const pk = parseFloat(editForm.priceKg || x.priceKg) || x.priceKg;
                        return { ...x, ...editForm, weight: w, priceKg: pk, total: Math.round(w * pk) };
                      }));
                      setEditId(null); setEditForm(null);
                    }} style={{ ...S.btn(C.accent), flex: 1, padding: "7px", fontSize: 12 }}>✓ Save</button>
                    <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...S.btn("#374151"), flex: 1, padding: "7px", fontSize: 12 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>
                      {s.date} · {s.worker} · {pig ? pig.tag : "—"} · {s.buyer || "—"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ color: "#10b981", fontWeight: 700 }}>{fmtRWF(s.total)}</span>
                    {isAdmin && (
                      <div style={{ display: "flex", gap: 5, marginTop: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => {
                          setEditId(s.id);
                          setEditForm({ buyer: s.buyer || "", weight: String(s.weight || ""), priceKg: String(s.priceKg || ""), date: s.date });
                        }} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid " + C.border, background: "transparent", color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
                        <button onClick={() => {
                          if (window.confirm("Delete this sale record?")) {
                            const u = sales.filter(x => x.id !== s.id);
                            setSales(u);
                            fsSet("sales", u);
                          }
                        }} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(239,68,68,.3)", background: "transparent", color: C.red, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: "6px 0 12px" }}>✦ AI Sales Strategy</div>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes}
        topic="Best sell timing Rwanda, optimal weight at sale, market forecast, best buyers."
        label="Sales & Market Forecast" icon="🏷️" />
    </div>
  );
}
