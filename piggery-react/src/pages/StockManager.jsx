import { fsSet } from '../lib/firestore';
import React, { useState } from 'react';
import { C, S } from '../utils/constants';
import { uid, toDay, fmtRWF, fmtNum, capitalTx } from '../utils/helpers';

export default function StockManager({ stock, setStock, feeds, pigs, capital, setCapital }) {
  const [tab, setTab] = useState('inventory');
  const [form, setForm] = useState({ name: '', category: 'Feed', quantity: '', unit: 'kg', minLevel: '', costPerUnit: '', notes: '' });
  const [saved, setSaved] = useState(false);
  const [adjId, setAdjId] = useState(null);
  const [adjQty, setAdjQty] = useState('');
  const CATEGORIES = ['Feed', 'Medicine', 'Vaccine', 'Equipment', 'Other'];

  const active = pigs.filter(p => p.status === 'active');
  const STAGE_FEED_KG = { Piglet: 0.5, Weaner: 1.0, Grower: 1.8, Finisher: 2.8, Gilt: 2.2, Sow: 2.5, Boar: 2.0 };
  const dailyFeedKg = Math.round(active.reduce((s, p) => s + (STAGE_FEED_KG[p.stage] || 2.0), 0) * 10) / 10;
  const monthFeedKg = Math.round(dailyFeedKg * 30);
  const totalFeedStock = stock.filter(s => s.category === 'Feed').reduce((t, s) => t + (s.unit === 'kg' ? s.quantity : 0), 0);
  const daysOfFeedLeft = dailyFeedKg > 0 ? Math.floor(totalFeedStock / dailyFeedKg) : 999;
  const lowItems = stock.filter(s => s.quantity <= s.minLevel);
  const criticalItems = stock.filter(s => s.quantity < s.minLevel * 0.5);
  const totalStockValue = stock.reduce((t, s) => t + (s.quantity * (s.costPerUnit || 0)), 0);

  function addItem() {
    if (!form.name || !form.quantity) return;
    const qty = parseFloat(form.quantity) || 0;
    const cpu = parseFloat(form.costPerUnit) || 0;
    const totalCost = qty * cpu;
    setStock(p => {
      const updated = [...p, { ...form, id: uid(), quantity: qty, minLevel: parseFloat(form.minLevel) || 0, costPerUnit: cpu, lastUpdated: toDay() }];
      fsSet('stock', updated);
      window._addAuditLog && window._addAuditLog('add', `Stock item added: ${form.name} (${qty}${form.unit})`);
      return updated;
    });
    if (setCapital && totalCost > 0) {
      const cat = form.category === 'Medicine' ? 'Medicine' : form.category === 'Vaccine' ? 'Veterinary' : form.category === 'Feed' ? 'Feed Purchase' : 'Equipment';
      capitalTx(capital, setCapital, { type: 'expense', category: cat, amount: totalCost, description: `Purchased ${qty} ${form.unit} of ${form.name}`, date: toDay() });
    }
    setSaved(true);
    setTimeout(() => { setSaved(false); setForm({ name: '', category: 'Feed', quantity: '', unit: 'kg', minLevel: '', costPerUnit: '', notes: '' }); }, 2000);
  }

  function adjust(id, delta) {
    const _stk = stock.find(s => s.id === id);
    setStock(p => {
      const updated = p.map(s => s.id === id ? { ...s, quantity: Math.max(0, s.quantity + delta), lastUpdated: toDay() } : s);
      fsSet('stock', updated);
      window._addAuditLog && window._addAuditLog('edit', `Stock adjusted: ${_stk ? _stk.name : 'item'} ${delta > 0 ? '+' : ''}${delta}`);
      return updated;
    });
  }

  function applyAdj(id) {
    const delta = parseFloat(adjQty) || 0;
    if (delta !== 0) adjust(id, delta);
    setAdjId(null); setAdjQty('');
  }

  const statusColor = (s) => s.quantity < s.minLevel * 0.5 ? 'rgba(239,68,68,.12)' : s.quantity <= s.minLevel ? 'rgba(245,158,11,.08)' : 'transparent';
  const statusBorder = (s) => s.quantity < s.minLevel * 0.5 ? C.red : s.quantity <= s.minLevel ? C.amber : C.border;

  return (
    <div>
      <div style={S.h1}>📦 Stock Management</div>
      <div style={S.sub}>Track feed, medicine, vaccines & supplies · Auto-alerts for low stock</div>

      {/* Alerts */}
      {criticalItems.length > 0 && (
        <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 9, marginBottom: 12, fontSize: 13, color: C.red }}>
          🚨 <strong>Critical low stock!</strong> {criticalItems.map(s => s.name).join(', ')} — Restock immediately
        </div>
      )}
      {lowItems.length > 0 && lowItems.length !== criticalItems.length && (
        <div style={{ padding: '11px 14px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.3)', borderRadius: 9, marginBottom: 12, fontSize: 13, color: C.amber }}>
          ⚠️ <strong>Low stock:</strong> {lowItems.filter(s => s.quantity > s.minLevel * 0.5).map(s => s.name).join(', ')}
        </div>
      )}

      {/* Stats */}
      <div style={S.g4}>
        {[
          { l: 'Total Items', v: stock.length, c: C.accent },
          { l: 'Low Stock Alerts', v: lowItems.length, c: lowItems.length > 0 ? C.red : C.accent },
          { l: 'Feed Stock', v: totalFeedStock + 'kg', c: C.amber },
          { l: 'Days of Feed Left', v: daysOfFeedLeft < 30 ? daysOfFeedLeft + 'd' : daysOfFeedLeft + 'd+', c: daysOfFeedLeft < 7 ? C.red : daysOfFeedLeft < 14 ? C.amber : C.accent },
        ].map(s => (
          <div key={s.l} style={S.stat}><div style={S.sl}>{s.l}</div><div style={{ ...S.sv, color: s.c }}>{s.v}</div></div>
        ))}
      </div>

      {/* Feed consumption monitor */}
      {active.length > 0 && (
        <div style={{ ...S.card, padding: 14, marginBottom: 14, background: 'rgba(22,163,74,.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8, fontWeight: 700, color: C.accent }}>
            <span>🌾 Feed Consumption Monitor</span>
            <span style={{ color: daysOfFeedLeft < 7 ? C.red : daysOfFeedLeft < 14 ? C.amber : C.accent }}>{daysOfFeedLeft} days of feed remaining</span>
          </div>
          <div style={{ height: 8, background: C.elevated, borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: Math.min(100, daysOfFeedLeft / 30 * 100) + '%', background: daysOfFeedLeft < 7 ? C.red : daysOfFeedLeft < 14 ? C.amber : C.accent, borderRadius: 8, transition: 'width .4s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.faint }}>
            <span>{active.length} pigs (stage-based avg) = {dailyFeedKg}kg/day</span>
            <span>Monthly need: ~{fmtNum(monthFeedKg)}kg</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', background: C.elevated, borderRadius: 9, padding: 3, marginBottom: 16, gap: 2, border: '1px solid ' + C.border }}>
        {[['inventory', '📦 Inventory'], ['add', '➕ Add Item'], ['alerts', '⚠️ Alerts (' + lowItems.length + ')']].map(([t, l]) => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {/* INVENTORY */}
      {tab === 'inventory' && (
        <div>
          {stock.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No stock items yet. Add your first item.</div>}
          {CATEGORIES.map(cat => {
            const catItems = stock.filter(s => s.category === cat);
            if (catItems.length === 0) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .8 }}>{cat}</div>
                {catItems.map((s, i) => (
                  <div key={i} style={{ ...S.card, marginBottom: 8, border: '1px solid ' + statusBorder(s), background: s.quantity <= s.minLevel ? statusColor(s) : C.surface }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: C.text }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: C.faint, marginTop: 1 }}>Min level: {s.minLevel}{s.unit} · Updated: {s.lastUpdated}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.quantity <= s.minLevel * 0.5 ? C.red : s.quantity <= s.minLevel ? C.amber : C.accent }}>
                          {fmtNum(s.quantity)}<span style={{ fontSize: 12, fontWeight: 400 }}>{s.unit}</span>
                        </div>
                        {s.costPerUnit > 0 && <div style={{ fontSize: 10, color: C.faint }}>{fmtRWF(s.quantity * s.costPerUnit)}</div>}
                      </div>
                    </div>
                    <div style={{ height: 5, background: C.elevated, borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: s.minLevel > 0 ? Math.min(100, (s.quantity / s.minLevel) * 50) + '%' : '50%', background: s.quantity <= s.minLevel * 0.5 ? C.red : s.quantity <= s.minLevel ? C.amber : C.accent, borderRadius: 5 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button onClick={() => adjust(s.id, -1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.elevated, color: C.text, fontSize: 12, cursor: 'pointer' }}>−</button>
                      {adjId === s.id ? (
                        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                          <input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} placeholder="+/- amount" style={{ ...S.inp, flex: 1, padding: '4px 8px', fontSize: 12 }} autoFocus />
                          <button onClick={() => applyAdj(s.id)} style={{ ...S.btn(C.accent), padding: '4px 10px', fontSize: 11, marginRight: 0 }}>✓</button>
                          <button onClick={() => { setAdjId(null); setAdjQty(''); }} style={{ ...S.btn('#374151'), padding: '4px 8px', fontSize: 11 }}>✗</button>
                        </div>
                      ) : (
                        <button onClick={() => setAdjId(s.id)} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid ' + C.border, background: C.elevated, color: C.muted, fontSize: 12, cursor: 'pointer', flex: 1 }}>Adjust Qty</button>
                      )}
                      <button onClick={() => adjust(s.id, 1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid ' + C.border, background: C.elevated, color: C.text, fontSize: 12, cursor: 'pointer' }}>+</button>
                      <button onClick={() => setStock(p => p.filter(x => x.id !== s.id))} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'transparent', color: C.red, fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {stock.length > 0 && (
            <div style={{ ...S.card, padding: 12, background: 'rgba(22,163,74,.04)', border: '1px solid rgba(22,163,74,.15)' }}>
              <div style={{ fontSize: 12, color: C.muted }}>Total inventory value: <strong style={{ color: C.accent }}>{fmtRWF(totalStockValue)}</strong></div>
            </div>
          )}
        </div>
      )}

      {/* ADD ITEM */}
      {tab === 'add' && (
        <div style={{ maxWidth: 500 }}>
          {saved && <div style={{ padding: 10, background: C.accentSoft, borderRadius: 8, marginBottom: 12, color: C.accent, fontSize: 13 }}>✓ Stock item added!</div>}
          <div style={S.card}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Item Name *</label><input placeholder="e.g. Maize Bran" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={S.inp} /></div>
              <div><label style={S.lbl}>Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={S.inp}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label style={S.lbl}>Unit</label><select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={S.inp}>{['kg', 'litres', 'doses', 'pcs', 'bags', 'boxes'].map(u => <option key={u}>{u}</option>)}</select></div>
              <div><label style={S.lbl}>Current Quantity *</label><input type="number" placeholder="100" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={S.inp} /></div>
              <div><label style={S.lbl}>Minimum Level Alert</label><input type="number" placeholder="20" value={form.minLevel} onChange={e => setForm({ ...form, minLevel: e.target.value })} style={S.inp} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={S.lbl}>Cost Per Unit (RWF)</label><input type="number" placeholder="350" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} style={S.inp} /></div>
            </div>
            {form.quantity && form.costPerUnit && parseFloat(form.quantity) > 0 && parseFloat(form.costPerUnit) > 0 && (
              <div style={{ padding: '9px 13px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, marginBottom: 12, fontSize: 13, color: C.red, fontWeight: 600 }}>
                💰 Capital expense: {fmtRWF(parseFloat(form.quantity) * parseFloat(form.costPerUnit))} will be deducted from capital
              </div>
            )}
            <button style={{ ...S.btn(), width: '100%', padding: 12, fontSize: 14 }} onClick={addItem}>📦 Add to Stock →</button>
          </div>
        </div>
      )}

      {/* ALERTS */}
      {tab === 'alerts' && (
        <div>
          {lowItems.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13, textAlign: 'center', padding: 40 }}>✅ All stock levels are healthy!</div>}
          {criticalItems.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 8, textTransform: 'uppercase' }}>🚨 Critical — Restock Immediately</div>
              {criticalItems.map(s => (
                <div key={s.id} style={{ ...S.card, border: '1px solid ' + C.red, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontWeight: 700, color: C.red }}>{s.name}</div><div style={{ fontSize: 11, color: C.faint }}>{s.category} · Min: {s.minLevel}{s.unit}</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 18, fontWeight: 800, color: C.red }}>{s.quantity}{s.unit}</div><div style={{ fontSize: 10, color: C.faint }}>Need {s.minLevel - s.quantity}+ more</div></div>
                  </div>
                </div>
              ))}
            </>
          )}
          {lowItems.filter(s => s.quantity > s.minLevel * 0.5).length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 8, marginTop: 12, textTransform: 'uppercase' }}>⚠️ Low Stock — Order Soon</div>
              {lowItems.filter(s => s.quantity > s.minLevel * 0.5).map(s => (
                <div key={s.id} style={{ ...S.card, border: '1px solid ' + C.amber, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontWeight: 700, color: C.amber }}>{s.name}</div><div style={{ fontSize: 11, color: C.faint }}>{s.category} · Min: {s.minLevel}{s.unit}</div></div>
                    <div style={{ textAlign: 'right' }}><div style={{ fontSize: 18, fontWeight: 800, color: C.amber }}>{s.quantity}{s.unit}</div><div style={{ fontSize: 10, color: C.faint }}>Min level: {s.minLevel}</div></div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
