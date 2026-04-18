import { C, S } from '../styles/theme';
import { fsSet } from '../lib/firestore';
import React, { useState } from 'react';
import { C, S } from '../utils/constants';
import {
  uid, toDay, fmtRWF, capitalTx,
  calcPnL, EXPENSE_CATS, INCOME_CATS,
} from '../utils/helpers';

export default function Ledger({
  expenses, setExpenses, incomes, setIncomes,
  feeds, setFeeds, sales, setSales,
  capital, setCapital
}) {
  const [tab, setTab] = useState('overview');
  const [eForm, setEForm] = useState({ date: toDay(), category: 'Feed Purchase', amount: '', description: '' });
  const [iForm, setIForm] = useState({ date: toDay(), category: 'Pig Sale', amount: '', description: '' });
  const [eSaved, setESaved] = useState(false);
  const [iSaved, setISaved] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const { totalInc: totalIncome, totalExp: totalExpense, profit } = calcPnL(capital || { transactions: [] }, feeds, sales, expenses, incomes);
  const totalSaleInc = sales.reduce((s, l) => s + (l.total || 0), 0);
  const totalOtherInc = incomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalFeedCost = feeds.reduce((s, l) => s + (l.cost || 0), 0);
  const totalOtherExp = expenses.reduce((s, l) => s + (l.amount || 0), 0);
  const margin = totalIncome > 0 ? ((profit / totalIncome) * 100).toFixed(1) : '—';

  const allTx = [
    ...sales.map(s => ({ id: s.id, date: s.date, type: 'income', cat: 'Pig Sale', desc: `${s.buyer || 'Buyer'} — ${s.weight || 0}kg @ RWF ${s.priceKg || 0}/kg`, amount: s.total, src: 'sale', worker: s.worker })),
    ...incomes.map(i => ({ ...i, type: 'income', cat: i.category, src: 'income', desc: i.description || i.category, worker: i.worker || 'Admin' })),
    ...feeds.map(f => ({ id: f.id, date: f.date, type: 'expense', cat: 'Feed Purchase', desc: `${f.feedType} ${f.kg}kg — ${f.worker}`, amount: f.cost, src: 'feed', worker: f.worker })),
    ...expenses.map(e => ({ ...e, type: 'expense', cat: e.category, src: 'expense', desc: e.description || e.category, worker: e.worker || 'Admin' })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Running balance
  let runBalance = capital.initial || 0;
  const txWithBalance = [...allTx].reverse().map(tx => {
    runBalance += tx.type === 'income' ? tx.amount : -tx.amount;
    return { ...tx, runBal: runBalance };
  }).reverse();

  const filtered = txWithBalance.filter(tx => {
    if (filterType === 'income' && tx.type !== 'income') return false;
    if (filterType === 'expense' && tx.type !== 'expense') return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(tx.cat || '').toLowerCase().includes(q) && !(tx.desc || '').toLowerCase().includes(q) && !(tx.worker || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const incByCat = {};
  sales.forEach(s => { incByCat['Pig Sale'] = (incByCat['Pig Sale'] || 0) + (s.total || 0); });
  incomes.forEach(i => { incByCat[i.category] = (incByCat[i.category] || 0) + (i.amount || 0); });

  const expByCat = {};
  feeds.forEach(f => { expByCat['Feed Purchase'] = (expByCat['Feed Purchase'] || 0) + (f.cost || 0); });
  expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + (e.amount || 0); });

  function addExpense() {
    if (!eForm.amount) return;
    const newE = { ...eForm, id: uid(), amount: parseFloat(eForm.amount), worker: 'Admin' };
    setExpenses(p => { const updated = [...p, newE]; fsSet('expenses', updated); return updated; });
    if (setCapital) capitalTx(capital, setCapital, { type: 'expense', category: eForm.category, amount: parseFloat(eForm.amount), description: eForm.description, date: eForm.date });
    window._addAuditLog && window._addAuditLog('add', `Expense added: ${eForm.category} ${fmtRWF(parseFloat(eForm.amount))} (${eForm.date})`);
    setESaved(true);
    setTimeout(() => { setESaved(false); setEForm({ date: toDay(), category: 'Feed Purchase', amount: '', description: '' }); }, 2000);
  }

  function addIncome() {
    if (!iForm.amount) return;
    const newI = { ...iForm, id: uid(), amount: parseFloat(iForm.amount), worker: 'Admin' };
    setIncomes(p => { const updated = [...p, newI]; fsSet('incomes', updated); return updated; });
    if (setCapital) capitalTx(capital, setCapital, { type: 'income', category: iForm.category, amount: parseFloat(iForm.amount), description: iForm.description, date: iForm.date });
    window._addAuditLog && window._addAuditLog('add', `Income added: ${iForm.category} ${fmtRWF(parseFloat(iForm.amount))} (${iForm.date})`);
    setISaved(true);
    setTimeout(() => { setISaved(false); setIForm({ date: toDay(), category: 'Pig Sale', amount: '', description: '' }); }, 2000);
  }

  function deleteIncome(id) {
    const _inc = incomes.find(i => i.id === id);
    setIncomes(p => { const updated = p.filter(i => i.id !== id); fsSet('incomes', updated); return updated; });
    window._addAuditLog && window._addAuditLog('delete', `Income deleted: ${_inc ? _inc.category + ' ' + fmtRWF(_inc.amount) : ''}`);
  }

  function deleteExpense(id) {
    const _exp = expenses.find(e => e.id === id);
    setExpenses(p => { const updated = p.filter(e => e.id !== id); fsSet('expenses', updated); return updated; });
    window._addAuditLog && window._addAuditLog('delete', `Expense deleted: ${_exp ? _exp.category + ' ' + fmtRWF(_exp.amount) : ''}`);
  }

  function saveEdit() {
    if (!editItem) return;
    if (editItem.src === 'income') setIncomes(p => { const updated = p.map(i => i.id === editItem.id ? { ...i, ...editItem, amount: parseFloat(editItem.amount) || i.amount } : i); fsSet('incomes', updated); return updated; });
    if (editItem.src === 'expense') setExpenses(p => { const updated = p.map(e => e.id === editItem.id ? { ...e, ...editItem, amount: parseFloat(editItem.amount) || e.amount } : e); fsSet('expenses', updated); return updated; });
    window._addAuditLog && window._addAuditLog('edit', `${editItem.src === 'income' ? 'Income' : 'Expense'} edited: ${editItem.category} ${fmtRWF(parseFloat(editItem.amount) || 0)}`);
    setEditItem(null);
  }

  return (
    <div>
      <div style={S.h1}>📒 Income & Expense Ledger</div>
      <div style={S.sub}>Full financial record — all transactions, running balance & analytics</div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total Income', v: fmtRWF(totalIncome), c: '#10b981' },
          { l: 'Total Expenses', v: fmtRWF(totalExpense), c: C.red },
          { l: 'Net Profit', v: fmtRWF(profit), c: profit >= 0 ? C.accent : C.red },
          { l: 'Net Margin', v: margin + '%', c: parseFloat(margin) >= 20 ? C.accent : parseFloat(margin) >= 0 ? C.amber : C.red },
        ].map(s => (
          <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{ ...S.sv, color: s.c, fontSize: s.v.length > 10 ? 13 : 18 }}>{s.v}</div></div>
        ))}
      </div>

      {/* Visual profit bar */}
      <div style={{ ...S.card, padding: '13px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ color: C.muted, fontWeight: 600 }}>Expense Ratio</span>
          <span style={{ color: profit >= 0 ? C.accent : C.red, fontWeight: 700 }}>{profit >= 0 ? '✅ Profitable' : '⚠️ Running at loss'}</span>
        </div>
        <div style={{ height: 12, background: C.elevated, borderRadius: 8, overflow: 'hidden', marginBottom: 5 }}>
          <div style={{ height: '100%', width: (totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0) + '%', background: totalExpense > totalIncome ? 'linear-gradient(90deg,#ef4444,#dc2626)' : 'linear-gradient(90deg,#f59e0b,#d97706)', borderRadius: 8, transition: 'width .4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.faint }}>
          <span>Expenses: <b style={{ color: C.red }}>{fmtRWF(totalExpense)}</b></span>
          <span>Income: <b style={{ color: '#10b981' }}>{fmtRWF(totalIncome)}</b></span>
          <span>Profit: <b style={{ color: profit >= 0 ? C.accent : C.red }}>{fmtRWF(profit)}</b></span>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border, flexWrap: 'wrap' }}>
        {[['overview', '📊 Overview'], ['income', '💚 Add Income'], ['expenses', '🔴 Add Expense'], ['all', '📋 All Transactions']].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div style={S.g2}>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#10b981', marginBottom: 12 }}>💚 Income Sources</div>
            {Object.entries(incByCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
              const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(0) : 0;
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: C.muted }}>{cat}</span>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(amt)} <span style={{ color: C.faint, fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 5, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: '#10b981', borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(incByCat).length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No income yet.</div>}
            <div style={{ ...S.row, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 7, marginTop: 8 }}>
              <span style={{ fontWeight: 700, color: C.text }}>TOTAL</span>
              <span style={{ color: '#10b981', fontWeight: 800 }}>{fmtRWF(totalIncome)}</span>
            </div>
          </div>
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 12 }}>🔴 Expense Categories</div>
            {Object.entries(expByCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
              const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(0) : 0;
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span style={{ color: C.muted }}>{cat}</span>
                    <span style={{ color: C.red, fontWeight: 700 }}>{fmtRWF(amt)} <span style={{ color: C.faint, fontWeight: 400 }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 5, background: C.elevated, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: C.red, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(expByCat).length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No expenses yet.</div>}
            <div style={{ ...S.row, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 7, marginTop: 8 }}>
              <span style={{ fontWeight: 700, color: C.text }}>TOTAL</span>
              <span style={{ color: C.red, fontWeight: 800 }}>{fmtRWF(totalExpense)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ADD INCOME */}
      {tab === 'income' && (
        <div style={{ maxWidth: 500 }}>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 14 }}>💚 Record Manual Income</div>
            {iSaved && <div style={{ padding: 10, background: 'rgba(16,185,129,.08)', borderRadius: 8, marginBottom: 12, color: '#10b981', fontSize: 13, fontWeight: 600 }}>✅ Income recorded!</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={S.lbl}>Date</label><input type="date" value={iForm.date} onChange={e => setIForm({ ...iForm, date: e.target.value })} style={S.inp} /></div>
              <div><label style={S.lbl}>Category</label>
                <select value={iForm.category} onChange={e => setIForm({ ...iForm, category: e.target.value })} style={S.inp}>
                  {INCOME_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Amount (RWF) *</label><input type="number" placeholder="e.g. 50000" value={iForm.amount} onChange={e => setIForm({ ...iForm, amount: e.target.value })} style={S.inp} /></div>
              <div><label style={S.lbl}>Description</label><input placeholder="e.g. Manure sale" value={iForm.description} onChange={e => setIForm({ ...iForm, description: e.target.value })} style={S.inp} /></div>
            </div>
            {iForm.amount && parseFloat(iForm.amount) > 0 && (
              <div style={{ padding: '9px 13px', background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                Capital will increase by {fmtRWF(parseFloat(iForm.amount))}
              </div>
            )}
            <button disabled={!iForm.amount || parseFloat(iForm.amount) <= 0} style={{ ...S.btn('#166534'), width: '100%', padding: 12, fontSize: 14, opacity: !iForm.amount ? 0.5 : 1 }} onClick={addIncome}>💚 Record Income →</button>
          </div>
        </div>
      )}

      {/* ADD EXPENSE */}
      {tab === 'expenses' && (
        <div style={{ maxWidth: 500 }}>
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 14 }}>🔴 Record Manual Expense</div>
            {eSaved && <div style={{ padding: 10, background: 'rgba(239,68,68,.08)', borderRadius: 8, marginBottom: 12, color: C.red, fontSize: 13, fontWeight: 600 }}>✅ Expense recorded!</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div><label style={S.lbl}>Date</label><input type="date" value={eForm.date} onChange={e => setEForm({ ...eForm, date: e.target.value })} style={S.inp} /></div>
              <div><label style={S.lbl}>Category</label>
                <select value={eForm.category} onChange={e => setEForm({ ...eForm, category: e.target.value })} style={S.inp}>
                  {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={S.lbl}>Amount (RWF) *</label><input type="number" placeholder="e.g. 15000" value={eForm.amount} onChange={e => setEForm({ ...eForm, amount: e.target.value })} style={S.inp} /></div>
              <div><label style={S.lbl}>Description</label><input placeholder="e.g. 3 bags Maize bran" value={eForm.description} onChange={e => setEForm({ ...eForm, description: e.target.value })} style={S.inp} /></div>
            </div>
            {eForm.amount && parseFloat(eForm.amount) > 0 && (
              <div style={{ padding: '9px 13px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: C.red, fontWeight: 600 }}>
                Capital will decrease by {fmtRWF(parseFloat(eForm.amount))}
              </div>
            )}
            <button disabled={!eForm.amount || parseFloat(eForm.amount) <= 0} style={{ ...S.btn(C.red), width: '100%', padding: 12, fontSize: 14, opacity: !eForm.amount ? 0.5 : 1 }} onClick={addExpense}>🔴 Record Expense →</button>
          </div>
        </div>
      )}

      {/* ALL TRANSACTIONS */}
      {tab === 'all' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12 }}>
            <input placeholder="🔍 Search by category, description, worker…" value={search} onChange={e => setSearch(e.target.value)} style={S.inp} />
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...S.inp, width: 'auto' }}>
              <option value="all">All Types</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>
          </div>
          {(search || filterType !== 'all') && (
            <div style={{ ...S.card, padding: '10px 14px', marginBottom: 12, background: 'rgba(22,163,74,.04)' }}>
              <div style={{ fontSize: 12, color: C.muted }}>
                Showing {filtered.length} of {allTx.length} transactions
                {filterType === 'income' && <span style={{ color: '#10b981', fontWeight: 700, marginLeft: 8 }}>Total: {fmtRWF(filtered.reduce((s, t) => s + (t.amount || 0), 0))}</span>}
                {filterType === 'expense' && <span style={{ color: C.red, fontWeight: 700, marginLeft: 8 }}>Total: {fmtRWF(filtered.reduce((s, t) => s + (t.amount || 0), 0))}</span>}
              </div>
            </div>
          )}
          <div style={S.card}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 12 }}>All Transactions ({allTx.length})</div>
            {filtered.length === 0 && <div style={{ color: C.faint, fontSize: 13, textAlign: 'center', padding: 20 }}>{search ? 'No results for your search.' : 'No transactions yet.'}</div>}
            {filtered.map((tx, i) => (
              <div key={i} style={{ borderBottom: '1px solid ' + C.elevated, paddingBottom: 8, marginBottom: 8 }}>
                {editItem && editItem.id === tx.id ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <div><label style={S.lbl}>Amount (RWF)</label><input type="number" value={editItem.amount} onChange={e => setEditItem({ ...editItem, amount: e.target.value })} style={S.inp} /></div>
                      <div><label style={S.lbl}>Date</label><input type="date" value={editItem.date} onChange={e => setEditItem({ ...editItem, date: e.target.value })} style={S.inp} /></div>
                      <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Description</label><input value={editItem.desc || editItem.description || ''} onChange={e => setEditItem({ ...editItem, desc: e.target.value, description: e.target.value })} style={S.inp} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveEdit} style={{ ...S.btn(C.accent), flex: 1, padding: '7px', fontSize: 12 }}>✓ Save</button>
                      <button onClick={() => setEditItem(null)} style={{ ...S.btn('#374151'), flex: 1, padding: '7px', fontSize: 12 }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 12, background: tx.type === 'income' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)', color: tx.type === 'income' ? '#10b981' : C.red, fontWeight: 700 }}>{tx.type === 'income' ? '↑ IN' : '↓ OUT'}</span>
                        <span style={{ color: C.text, fontWeight: 600, fontSize: 12 }}>{tx.cat}</span>
                        {tx.worker && <span style={{ fontSize: 10, color: C.faint }}>· {tx.worker}</span>}
                      </div>
                      {(tx.desc || tx.description) && <div style={{ fontSize: 11, color: C.faint, paddingLeft: 38 }}>{tx.desc || tx.description}</div>}
                      <div style={{ fontSize: 10, color: C.faint, paddingLeft: 38, marginTop: 1 }}>{tx.date}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, color: tx.type === 'income' ? '#10b981' : C.red, fontSize: 14 }}>{tx.type === 'income' ? '+' : '-'}{fmtRWF(tx.amount)}</div>
                      <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>Bal: {fmtRWF(tx.runBal)}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                        {(tx.src === 'income' || tx.src === 'expense') && (
                          <button onClick={() => setEditItem({ ...tx })} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid ' + C.border, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
                        )}
                        <button onClick={() => {
                          if (window.confirm('Delete this record? This will reverse the capital effect.')) {
                            if (tx.src === 'income') deleteIncome(tx.id);
                            else if (tx.src === 'expense') deleteExpense(tx.id);
                            else if (tx.src === 'sale') { setSales(p => { const u = p.filter(s => s.id !== tx.id); fsSet('sales', u); window._addAuditLog && window._addAuditLog('delete', `Capital sale transaction deleted: ${fmtRWF(tx.amount || 0)}`); return u; }); }
                            else if (tx.src === 'feed') { setFeeds(p => { const u = p.filter(f => f.id !== tx.id); fsSet('feeds', u); window._addAuditLog && window._addAuditLog('delete', `Capital feed transaction deleted: ${fmtRWF(tx.amount || 0)}`); return u; }); }
                          }
                        }} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {allTx.length > 0 && (
              <div style={{ padding: '9px 13px', background: profit >= 0 ? 'rgba(22,163,74,.06)' : 'rgba(239,68,68,.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ color: C.muted, fontSize: 12 }}>{allTx.length} transactions total</span>
                <span style={{ fontWeight: 700, color: profit >= 0 ? C.accent : C.red, fontSize: 13 }}>Net: {fmtRWF(profit)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
