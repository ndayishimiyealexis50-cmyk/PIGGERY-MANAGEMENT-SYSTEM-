import { fsSet } from '../lib/firestore';
import React, { useState } from 'react';
import { C, S } from '../utils/constants';
import { fmtRWF, isAdminUser, capitalTx } from '../utils/helpers';
import AIPrediction from './AIPrediction';
import PDFBtn from './PDFBtn';

export default function SaleLog({ sales, setSales, pigs, feeds, logs, expenses, incomes, allData, user, capital, setCapital }) {
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [addForm, setAddForm] = useState({ buyer: '', weight: '', priceKg: '', date: new Date().toISOString().slice(0, 10) });
  const isAdmin = isAdminUser(user);

  const handleAdd = () => {
    const weight = parseFloat(addForm.weight);
    const priceKg = parseFloat(addForm.priceKg);
    if (!addForm.buyer || !weight || !priceKg || !addForm.date) return alert('Fill all fields.');
    const total = weight * priceKg;
    const id = 'sale_' + Date.now();
    const entry = { id, buyer: addForm.buyer, weight, priceKg, total, date: addForm.date };
    const updated = [...sales, entry];
    setSales(updated);
    fsSet('sales', updated);
    if (capital && setCapital) capitalTx(capital, setCapital, { type: 'income', category: 'Pig Sale', amount: total, description: `Sold ${weight}kg to ${addForm.buyer}`, date: addForm.date });
    setAddForm({ buyer: '', weight: '', priceKg: '', date: new Date().toISOString().slice(0, 10) });
    setShowForm(false);
  };

  const handleEditSave = (s) => {
    const weight = parseFloat(editForm.weight);
    const priceKg = parseFloat(editForm.priceKg);
    const total = weight * priceKg;
    const updated = sales.map(x => x.id === s.id ? { ...x, ...editForm, weight, priceKg, total } : x);
    setSales(updated);
    fsSet('sales', updated);
    if (capital && setCapital) capitalTx(capital, setCapital, { type: 'income', category: 'Pig Sale', amount: total, description: `Sold ${weight}kg to ${addForm.buyer}`, date: addForm.date });
    setEditId(null);
    setEditForm(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <div style={S.h1}>Sales Records</div>
            <div style={S.sub}>{(isAdmin ? sales : sales.filter(s => s.worker === user?.name)).length} sales · {fmtRWF((isAdmin ? sales : sales.filter(s => s.worker === user?.name)).reduce((s, l) => s + (l.total || 0), 0))}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {isAdmin && (
            <button onClick={() => setShowForm(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>+ Add Sale</button>
          )}
          <PDFBtn label="Finance PDF" type="finance" getData={() => allData} icon="🧾" color="#374151" />
        </div>
      </div>

      {showForm && (
        <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>New Sale</div>
          {[
            { label: 'Buyer Name', key: 'buyer', type: 'text' },
            { label: 'Weight (kg)', key: 'weight', type: 'number' },
            { label: 'Price per kg (RWF)', key: 'priceKg', type: 'number' },
            { label: 'Date', key: 'date', type: 'date' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{f.label}</div>
              <input
                type={f.type}
                value={addForm[f.key]}
                onChange={e => setAddForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid ' + C.border, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          {addForm.weight && addForm.priceKg && (
            <div style={{ fontSize: 12, color: C.accent, marginBottom: 8 }}>
              Total: {fmtRWF(parseFloat(addForm.weight || 0) * parseFloat(addForm.priceKg || 0))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Save Sale</button>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: '1px solid ' + C.border, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={S.card}>
        {sales.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>No sales yet.</div>}
        {(isAdmin ? sales : sales.filter(s => s.worker === user?.name)).slice().reverse().map((s, i) => (
        
          <div key={s.id || i} style={{ borderBottom: '1px solid ' + C.border, paddingBottom: 8, marginBottom: 8 }}>
            {editId === s.id ? (
              <div>
                {[
                  { label: 'Buyer', key: 'buyer', type: 'text' },
                  { label: 'Weight (kg)', key: 'weight', type: 'number' },
                  { label: 'Price/kg', key: 'priceKg', type: 'number' },
                  { label: 'Date', key: 'date', type: 'date' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: C.muted }}>{f.label}</div>
                    <input
                      type={f.type}
                      value={editForm[f.key]}
                      onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', padding: '5px 7px', borderRadius: 5, border: '1px solid ' + C.border, background: C.bg, color: C.text, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button onClick={() => handleEditSave(s)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                  <button onClick={() => { setEditId(null); setEditForm(null); }} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid ' + C.border, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.buyer || 'Unknown'}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>{fmtRWF(s.total)}</span>
                </div>
                <div style={{ fontSize: 11, color: C.muted }}>{s.weight}kg · {fmtRWF(s.priceKg)}/kg · {s.date}</div>
                {isAdmin && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 4, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditId(s.id); setEditForm({ buyer: s.buyer || '', weight: String(s.weight || ''), priceKg: String(s.priceKg || ''), date: s.date }); }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid ' + C.border, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ Edit</button>
                    <button onClick={() => { if (window.confirm('Delete this sale record?')) { const u = sales.filter(x => x.id !== s.id); setSales(u); fsSet('sales', u); } }} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}>🗑️</button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: '6px 0 12px' }}>✦ AI Sales Strategy</div>
      <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} topic="Best sell timing, optimal weight at sale, market forecast, best buyers." label="Sales & Market Forecast" icon="🤝" />
    </div>
  );
}
