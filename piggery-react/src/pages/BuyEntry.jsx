import React, { useState } from 'react';
import { uid, toDay, capitalTx } from '../utils/helpers';
import { fsSet } from '../lib/firestore';

export default function BuyEntry({ stock, setStock, capital, setCapital, setPage, user }) {
  const [form, setForm] = useState({ name: '', category: 'Feed', quantity: '', unit: 'kg', costPerUnit: '', notes: '' });
  const [saving, setSaving] = useState(false);

  const categories = ['Feed', 'Medicine', 'Vaccine', 'Equipment', 'Other'];
  const units = ['kg', 'bags', 'litres', 'units', 'packs'];

  async function handleSave() {
    if (!form.name || !form.quantity || !form.costPerUnit) return alert('Fill all required fields.');
    setSaving(true);
    const qty = parseFloat(form.quantity);
    const cpu = parseFloat(form.costPerUnit);
    const totalCost = qty * cpu;

    const existing = (stock || []).find(s => s.name.toLowerCase() === form.name.toLowerCase() && s.category === form.category);
    let updated;
    if (existing) {
      updated = (stock || []).map(s => s.id === existing.id
        ? { ...s, quantity: s.quantity + qty, costPerUnit: cpu, lastUpdated: toDay() }
        : s);
    } else {
      updated = [...(stock || []), { id: uid(), name: form.name, category: form.category, quantity: qty, unit: form.unit, costPerUnit: cpu, minLevel: 0, notes: form.notes, lastUpdated: toDay() }];
    }
    setStock(updated);
    await fsSet('stock', updated);

    const cat = form.category === 'Medicine' ? 'Medicine' : form.category === 'Vaccine' ? 'Veterinary' : form.category === 'Feed' ? 'Feed Purchase' : 'Equipment';
    if (capital && setCapital) capitalTx(capital, setCapital, { type: 'expense', category: cat, amount: totalCost, description: `Purchased ${qty}${form.unit} of ${form.name}`, date: toDay() });

    setSaving(false);
    alert(`✅ ${form.name} added to stock. Cost: ${totalCost.toLocaleString()} RWF deducted from capital.`);
    setForm({ name: '', category: 'Feed', quantity: '', unit: 'kg', costPerUnit: '', notes: '' });
  }

  const inp = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', marginBottom: 10, boxSizing: 'border-box', fontSize: 14 };

  return (
    <div style={{ padding: 16, fontFamily: 'sans-serif', maxWidth: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => setPage('whome')} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>←</button>
        <div style={{ fontWeight: 700, fontSize: 18 }}>🛒 Buy Entry</div>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Item Name *</div>
        <input style={inp} placeholder="e.g. Pig Feed, Amoxicillin" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />

        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Category *</div>
        <select style={inp} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Quantity *</div>
            <input style={inp} type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Unit</div>
            <select style={inp} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              {units.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Cost Per Unit (RWF) *</div>
        <input style={inp} type="number" placeholder="0" value={form.costPerUnit} onChange={e => setForm({ ...form, costPerUnit: e.target.value })} />

        {form.quantity && form.costPerUnit && (
          <div style={{ background: '#f0fdf4', borderRadius: 8, padding: 10, marginBottom: 10, fontSize: 13 }}>
            💰 Total Cost: <strong>{(parseFloat(form.quantity || 0) * parseFloat(form.costPerUnit || 0)).toLocaleString()} RWF</strong>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 4 }}>Notes</div>
        <input style={inp} placeholder="Optional notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

        <button onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: '#0f3d1e', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          {saving ? 'Saving...' : '✅ Save Purchase'}
        </button>
      </div>
    </div>
  );
}
