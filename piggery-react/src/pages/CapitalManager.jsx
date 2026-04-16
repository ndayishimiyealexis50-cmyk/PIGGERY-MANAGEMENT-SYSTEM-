import { useState } from "react";
import { C, S } from "../styles";
import { uid, toDay, fmtRWF } from "../utils";
import { calcCapitalBalance } from "../utils/capital";
import { KPI } from "./KPI";

export default function CapitalManager({ capital, setCapital, feeds, sales, expenses, incomes, pigs, user }) {
  const isAdmin = user?.role?.toLowerCase() === "admin";
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState({ type: "income", category: "Other Income", amount: "", description: "", date: toDay() });
  const [saved, setSaved] = useState(false);
  const [editInitial, setEditInitial] = useState(false);
  const [newInitial, setNewInitial] = useState(String(capital.initial || ""));
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const txs = capital.transactions || [];
  const balance = calcCapitalBalance(capital, feeds, sales, expenses, incomes);
  const incomeTotal = sales.reduce((s, x) => s + (x.total || 0), 0) + incomes.reduce((s, x) => s + (x.amount || 0), 0);
  const expenseTotal = feeds.reduce((s, x) => s + (x.cost || 0), 0) + expenses.reduce((s, x) => s + (x.amount || 0), 0);

  const INCOME_CATS = ["Pig Sale", "Piglet Sale", "Manure Sale", "Investment", "Loan", "Gift", "Other Income"];
  const EXPENSE_CATS = ["Feed Purchase", "Pig Purchase", "Veterinary", "Medicine", "Equipment", "Labour", "Transport", "Utilities", "Maintenance", "Pig Death Loss", "Salary", "Salary Advance", "Other"];

  function addTx() {
    if (!form.amount || parseFloat(form.amount) <= 0) return;
    const tx = { id: uid(), type: form.type, category: form.category, amount: parseFloat(form.amount), description: form.description, date: form.date, createdAt: new Date().toISOString(), manual: true };
    setCapital(prev => ({ ...prev, transactions: [...(prev.transactions || []), tx] }));
    setSaved(true);
    setForm({ type: "income", category: "Other Income", amount: "", description: "", date: toDay() });
    setTimeout(() => setSaved(false), 2000);
  }

  function deleteTx(id) {
    setCapital(prev => ({ ...prev, transactions: (prev.transactions || []).filter(t => t.id !== id) }));
  }

  function saveEdit(id) {
    setCapital(prev => ({ ...prev, transactions: (prev.transactions || []).map(t => t.id === id ? { ...t, ...editForm, amount: parseFloat(editForm.amount) || t.amount } : t) }));
    setEditId(null); setEditForm(null);
  }

  const [capForm, setCapForm] = useState({ amount: "", description: "", date: toDay(), source: "Owner Investment" });
  const [capSaved, setCapSaved] = useState(false);
  const CAP_SOURCES = ["Owner Investment", "Bank Loan", "External Investor", "Grant/Subsidy", "Personal Savings", "Other"];

  function addCapital() {
    if (!capForm.amount || parseFloat(capForm.amount) <= 0) return;
    const amt = parseFloat(capForm.amount);
    const tx = { id: uid(), type: "income", category: "Capital Injection", amount: amt, description: (capForm.description || capForm.source) + " — added by admin", date: capForm.date, source: capForm.source, createdAt: new Date().toISOString(), manual: true };
    setCapital(prev => ({ ...prev, initial: (prev.initial || 0) + amt, transactions: [...(prev.transactions || []), tx] }));
    setCapSaved(true);
    setCapForm({ amount: "", description: "", date: toDay(), source: "Owner Investment" });
    setTimeout(() => setCapSaved(false), 2500);
  }

  const tabs = [{ id: "overview", l: "📊 Overview" }, { id: "inject", l: "💵 Add Capital" }, { id: "add", l: "➕ Transaction" }, { id: "history", l: "📋 History" }];

  return (
    <div>
      <div style={S.h1}>💵 Capital Management</div>
      <div style={S.sub}>Track your business capital · Admin only</div>

      {/* Balance Banner */}
      <div style={{ background: "linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)", borderRadius: 14, padding: "18px 20px", marginBottom: 16, position: "relative" }}>
        <div style={{ fontSize: 11, color: "rgba(74,222,128,.7)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Current Capital Balance</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: balance >= 0 ? "#4ade80" : "#f87171", marginBottom: 8 }}>{fmtRWF(balance)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {[["💰 Initial Capital", fmtRWF(capital.initial || 0), "rgba(74,222,128,.6)"], ["📥 Total Income", fmtRWF(incomeTotal), "#34d399"], ["📤 Total Expenses", fmtRWF(expenseTotal), "#f87171"]].map(([l, v, c]) => (
            <div key={l} style={{ background: "rgba(255,255,255,.06)", borderRadius: 9, padding: "8px 11px" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,.45)", marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>
        {isAdmin && <button onClick={() => { setEditInitial(!editInitial); setNewInitial(String(capital.initial || "")); }} style={{ position: "absolute", top: 16, right: 16, padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(74,222,128,.35)", background: "rgba(74,222,128,.1)", color: "#4ade80", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>⚙️ Edit Initial</button>}
      </div>

      {isAdmin && editInitial && (
        <div style={{ ...S.card, marginBottom: 14, border: "1px solid rgba(74,222,128,.3)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 10 }}>Set Initial Capital (before any transactions)</div>
          <div style={{ display: "flex", gap: 9 }}>
            <input type="number" value={newInitial} onChange={e => setNewInitial(e.target.value)} placeholder="e.g. 1000000" style={{ ...S.inp, flex: 1 }} />
            <button onClick={() => { setCapital(prev => ({ ...prev, initial: parseFloat(newInitial) || 0 })); setEditInitial(false); }} style={{ ...S.btn(C.accent), padding: "9px 16px" }}>Save</button>
            <button onClick={() => setEditInitial(false)} style={{ ...S.btn("#374151"), padding: "9px 16px" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: tab === t.id ? C.accent : "transparent", color: tab === t.id ? "#fff" : C.muted, fontWeight: tab === t.id ? 700 : 400, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{t.l}</button>)}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
            <KPI icon="💵" label="Net Capital" value={fmtRWF(balance)} color={balance >= 0 ? C.accent : C.red} />
            <KPI icon="📥" label="Total Income" value={fmtRWF(incomeTotal)} color="#10b981" />
            <KPI icon="📤" label="Total Expenses" value={fmtRWF(expenseTotal)} color={C.red} />
            <KPI icon="🔢" label="Transactions" value={txs.length} color={C.blue} />
            <KPI icon="💰" label="Initial Capital" value={fmtRWF(capital.initial || 0)} color={C.purple} />
            <KPI icon="📊" label="Net Margin" value={incomeTotal > 0 ? ((balance - (capital.initial || 0)) / incomeTotal * 100).toFixed(0) + "%" : "—"} color={C.amber} />
          </div>

          {/* Capital flow bar */}
          {(incomeTotal > 0 || expenseTotal > 0) && (
            <div style={{ ...S.card, padding: "13px 16px", marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 700, color: C.text }}>Capital Flow</span>
                <span style={{ color: balance >= 0 ? C.accent : C.red, fontWeight: 700 }}>{balance >= 0 ? "Positive" : "Negative"} balance</span>
              </div>
              {[["Income", incomeTotal, "#10b981", "linear-gradient(90deg,#10b981,#059669)"], ["Expenses", expenseTotal, C.red, "linear-gradient(90deg,#ef4444,#dc2626)"]].map(([label, val, color, grad]) => (
                <div key={label} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color, marginBottom: 3 }}>
                    <span>{label}</span><span>{fmtRWF(val)}</span>
                  </div>
                  <div style={{ height: 8, background: C.elevated, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: Math.min((val / Math.max(incomeTotal, expenseTotal)) * 100, 100) + "%", background: grad, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 Recent Transactions</div>
            {txs.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No transactions yet. Add one to get started.</div>}
            {txs.slice().reverse().slice(0, 8).map((tx, i) => (
              <div key={i} style={{ ...S.row, flexWrap: "wrap", gap: 4, borderBottom: "1px solid " + C.elevated, paddingBottom: 6, marginBottom: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 12, background: tx.type === "income" ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)", color: tx.type === "income" ? "#10b981" : C.red, fontWeight: 700 }}>{tx.type === "income" ? "↑ IN" : "↓ OUT"}</span>
                    <span style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{tx.category}</span>
                  </div>
                  {tx.description && <div style={{ fontSize: 11, color: C.faint, marginTop: 2, paddingLeft: 38 }}>{tx.description}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, color: tx.type === "income" ? "#10b981" : C.red, fontSize: 13 }}>{tx.type === "income" ? "+" : "-"}{fmtRWF(tx.amount)}</div>
                  <div style={{ fontSize: 10, color: C.faint }}>{tx.date}</div>
                </div>
              </div>
            ))}
            {txs.length > 8 && <button onClick={() => setTab("history")} style={{ ...S.btn(), width: "100%", marginTop: 8, fontSize: 12 }}>View All {txs.length} Transactions →</button>}
          </div>
        </div>
      )}

      {/* Add Capital (Inject) */}
      {tab === "inject" && (
        <div style={{ maxWidth: 500 }}>
          {capSaved && <div style={{ padding: 12, background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.35)", borderRadius: 9, marginBottom: 14, color: "#4ade80", fontSize: 13, fontWeight: 700 }}>✅ Capital added successfully! Balance updated.</div>}
          <div style={{ background: "linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)", borderRadius: 14, padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "rgba(74,222,128,.7)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Current Balance Before Injection</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: balance >= 0 ? "#4ade80" : "#f87171" }}>{fmtRWF(balance)}</div>
            {capForm.amount && parseFloat(capForm.amount) > 0 && <div style={{ fontSize: 13, color: "rgba(74,222,128,.8)", marginTop: 6 }}>After injection → <strong style={{ color: "#4ade80" }}>{fmtRWF(balance + parseFloat(capForm.amount))}</strong></div>}
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#4ade80", marginBottom: 4 }}>💵 Inject Capital</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>Add funds to your business capital — investment, loan, owner contribution, etc.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Amount (RWF) *</label>
                <input type="number" min="0" placeholder="e.g. 500000" value={capForm.amount} onChange={e => setCapForm({ ...capForm, amount: e.target.value })} style={S.inp} />
              </div>
              <div>
                <label style={S.lbl}>Source</label>
                <select value={capForm.source} onChange={e => setCapForm({ ...capForm, source: e.target.value })} style={S.inp}>
                  {CAP_SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Date</label>
                <input type="date" value={capForm.date} onChange={e => setCapForm({ ...capForm, date: e.target.value })} style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Description (optional)</label>
                <input placeholder="e.g. Monthly owner contribution, bank loan disbursement…" value={capForm.description} onChange={e => setCapForm({ ...capForm, description: e.target.value })} style={S.inp} />
              </div>
            </div>
            {capForm.amount && parseFloat(capForm.amount) > 0 && (
              <div style={{ padding: "10px 14px", background: "rgba(74,222,128,.08)", border: "1px solid rgba(74,222,128,.25)", borderRadius: 9, marginBottom: 14, fontSize: 13, color: "#4ade80", fontWeight: 600 }}>
                💰 Capital will increase by {fmtRWF(parseFloat(capForm.amount))} → New balance: {fmtRWF(balance + parseFloat(capForm.amount))}
              </div>
            )}
            <button onClick={addCapital} disabled={!capForm.amount || parseFloat(capForm.amount) <= 0}
              style={{ background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", border: "none", borderRadius: 10, padding: "13px", width: "100%", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (!capForm.amount || parseFloat(capForm.amount) <= 0) ? 0.5 : 1 }}>
              💵 Add Capital to Farm →
            </button>
          </div>
        </div>
      )}

      {/* Add Transaction */}
      {tab === "add" && (
        <div style={{ maxWidth: 500 }}>
          {saved && <div style={{ padding: 10, background: C.accentSoft, borderRadius: 8, marginBottom: 12, color: C.accent, fontSize: 13, fontWeight: 600 }}>✅ Transaction recorded!</div>}
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>➕ Record Transaction</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[["income", "📥 Income"], ["expense", "📤 Expense"]].map(([v, l]) => (
                <button key={v} onClick={() => setForm({ ...form, type: v, category: v === "income" ? "Other Income" : "Other" })} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "2px solid " + (form.type === v ? v === "income" ? C.accent : C.red : C.border), background: form.type === v ? v === "income" ? C.accentSoft : "rgba(239,68,68,.07)" : "transparent", color: form.type === v ? v === "income" ? C.accent : C.red : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.inp}>
                  {(form.type === "income" ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Amount (RWF) *</label>
                <input type="number" min="0" placeholder="e.g. 50000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={S.inp} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={S.lbl}>Description</label>
                <input placeholder="e.g. Bought 50kg maize bran from market" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={S.inp} />
              </div>
            </div>
            {form.amount && parseFloat(form.amount) > 0 && (
              <div style={{ padding: "9px 13px", background: form.type === "income" ? C.accentSoft : "rgba(239,68,68,.06)", borderRadius: 8, marginBottom: 12, fontSize: 13, color: form.type === "income" ? C.accent : C.red, fontWeight: 600 }}>
                Capital will {form.type === "income" ? "increase" : "decrease"} by {fmtRWF(parseFloat(form.amount))} → New balance: {fmtRWF(balance + (form.type === "income" ? parseFloat(form.amount) : -parseFloat(form.amount)))}
              </div>
            )}
            <button onClick={addTx} disabled={!form.amount || parseFloat(form.amount) <= 0} style={{ ...S.btn(form.type === "income" ? C.accent : C.red), width: "100%", padding: 12, fontSize: 14, opacity: !form.amount ? 0.5 : 1 }}>
              {form.type === "income" ? "📥 Record Income →" : "📤 Record Expense →"}
            </button>
          </div>
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div>
          <div style={{ background: "linear-gradient(145deg,#071410 0%,#0e2213 55%,#102616 100%)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "rgba(74,222,128,.6)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Current Balance</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: balance >= 0 ? "#4ade80" : "#f87171" }}>{fmtRWF(balance)}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 5, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "rgba(74,222,128,.6)" }}>↑ In: <b style={{ color: "#4ade80" }}>{fmtRWF(incomeTotal)}</b></span>
              <span style={{ fontSize: 11, color: "rgba(248,113,113,.6)" }}>↓ Out: <b style={{ color: "#f87171" }}>{fmtRWF(expenseTotal)}</b></span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>📋 {txs.length} tx</span>
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>📋 All Transactions ({txs.length})</div>
            {txs.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No transactions recorded yet.</div>}
            {txs.slice().reverse().map((tx, i) => (
              <div key={i} style={{ ...S.card, marginBottom: 8, padding: "10px 13px", border: "1px solid " + (tx.type === "income" ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)") }}>
                {editId === tx.id ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <div><label style={S.lbl}>Type</label>
                        <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} style={S.inp}><option value="income">Income</option><option value="expense">Expense</option></select>
                      </div>
                      <div><label style={S.lbl}>Amount</label><input type="number" value={editForm.amount} onChange={e => setEditForm({ ...editForm, amount: e.target.value })} style={S.inp} /></div>
                      <div><label style={S.lbl}>Category</label><input value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} style={S.inp} /></div>
                      <div><label style={S.lbl}>Date</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={S.inp} /></div>
                      <div style={{ gridColumn: "1/-1" }}><label style={S.lbl}>Description</label><input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={S.inp} /></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveEdit(tx.id)} style={{ ...S.btn(C.accent), flex: 1, padding: "8px", fontSize: 12 }}>✓ Save</button>
                      <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ ...S.btn("#374151"), flex: 1, padding: "8px", fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 12, background: tx.type === "income" ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)", color: tx.type === "income" ? "#10b981" : C.red, fontWeight: 700 }}>{tx.type === "income" ? "↑ IN" : "↓ OUT"}</span>
                        <span style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{tx.category}</span>
                        {tx.manual && <span style={{ fontSize: 9, color: C.faint, background: C.elevated, padding: "1px 5px", borderRadius: 5 }}>manual</span>}
                      </div>
                      {tx.description && <div style={{ fontSize: 11, color: C.faint, paddingLeft: 38 }}>{tx.description}</div>}
                      <div style={{ fontSize: 10, color: C.faint, paddingLeft: 38, marginTop: 2 }}>{tx.date}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: tx.type === "income" ? "#10b981" : C.red, fontSize: 14 }}>{tx.type === "income" ? "+" : "-"}{fmtRWF(tx.amount)}</div>
                      <div style={{ display: "flex", gap: 5, marginTop: 5, justifyContent: "flex-end" }}>
                        <button onClick={() => { setEditId(tx.id); setEditForm({ type: tx.type, category: tx.category, amount: String(tx.amount), description: tx.description || "", date: tx.date }); }} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, border: "1px solid " + C.border, background: "transparent", color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>✏️ Edit</button>
                        <button onClick={() => { if (window.confirm("Delete this transaction?")) deleteTx(tx.id); }} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(239,68,68,.3)", background: "transparent", color: C.red, cursor: "pointer", fontFamily: "inherit" }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
