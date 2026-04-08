import { useState } from 'react'

const initialEntries = [
  { id: 1, date: '2026-04-07', type: 'Income', category: 'Pig Sales', amount: 150000, description: '3 pigs sold to market', balance: 150000 },
  { id: 2, date: '2026-04-06', type: 'Expense', category: 'Feed', amount: 12000, description: 'Grower feed 6 bags', balance: 138000 },
  { id: 3, date: '2026-04-05', type: 'Expense', category: 'Medicine', amount: 3500, description: 'Vitamins & dewormers', balance: 134500 },
  { id: 4, date: '2026-04-03', type: 'Income', category: 'Piglet Sales', amount: 45000, description: '5 piglets sold', balance: 179500 },
  { id: 5, date: '2026-04-01', type: 'Expense', category: 'Labor', amount: 8000, description: 'Farm worker April salary', balance: 171500 },
]

const categories = {
  Income: ['Pig Sales', 'Piglet Sales', 'Manure Sales', 'Other Income'],
  Expense: ['Feed', 'Medicine', 'Labor', 'Equipment', 'Utilities', 'Other Expense'],
}

export default function Ledger() {
  const [entries, setEntries] = useState(initialEntries)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('All')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Income',
    category: 'Pig Sales',
    amount: '',
    description: ''
  })

  const totalIncome = entries.filter(e => e.type === 'Income').reduce((a, e) => a + e.amount, 0)
  const totalExpense = entries.filter(e => e.type === 'Expense').reduce((a, e) => a + e.amount, 0)
  const netBalance = totalIncome - totalExpense

  const handleAdd = () => {
    if (!form.amount || !form.description) return
    const newBalance = netBalance + (form.type === 'Income' ? +form.amount : -form.amount)
    const newEntry = { id: Date.now(), ...form, amount: +form.amount, balance: newBalance }
    setEntries([newEntry, ...entries])
    setForm({ date: new Date().toISOString().split('T')[0], type: 'Income', category: 'Pig Sales', amount: '', description: '' })
    setShowForm(false)
  }

  const filtered = filter === 'All' ? entries : entries.filter(e => e.type === filter)

  const fmt = (n) => 'RWF ' + n.toLocaleString()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem' }}>📒 Ledger</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Farm income & expense records</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: 'var(--green-light)',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '0.6rem 1.1rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          + Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#1a3320', border: '1px solid #2d5a27', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>INCOME</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4a8c3f' }}>{fmt(totalIncome)}</div>
        </div>
        <div style={{ background: '#2e1a1a', border: '1px solid #5a2727', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>EXPENSE</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c0392b' }}>{fmt(totalExpense)}</div>
        </div>
        <div style={{ background: netBalance >= 0 ? '#1a2e2e' : '#2e1a1a', border: '1px solid #2a3d3d', borderRadius: '12px', padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>BALANCE</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: netBalance >= 0 ? 'var(--accent)' : '#c0392b' }}>{fmt(netBalance)}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.2rem' }}>
        {['All', 'Income', 'Expense'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              background: filter === f ? 'var(--accent)' : 'var(--card)',
              color: filter === f ? '#111' : 'var(--muted)'
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid #2a3d28', borderRadius: '14px', padding: '1.2rem', marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>New Entry</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                style={{ width: '100%', background: '#111a0f', border: '1px solid #2a3d28', borderRadius: '8px', padding: '0.5rem 0.7rem', color: 'var(--text)', fontSize: '0.9rem' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: categories[e.target.value][0] })}
                style={{ width: '100%', background: '#111a0f', border: '1px solid #2a3d28', borderRadius: '8px', padding: '0.5rem 0.7rem', color: 'var(--text)', fontSize: '0.9rem' }}>
                <option>Income</option>
                <option>Expense</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                style={{ width: '100%', background: '#111a0f', border: '1px solid #2a3d28', borderRadius: '8px', padding: '0.5rem 0.7rem', color: 'var(--text)', fontSize: '0.9rem' }}>
                {categories[form.type].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Amount (RWF)</label>
              <input type="number" placeholder="e.g. 15000" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                style={{ width: '100%', background: '#111a0f', border: '1px solid #2a3d28', borderRadius: '8px', padding: '0.5rem 0.7rem', color: 'var(--text)', fontSize: '0.9rem' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Description</label>
              <input type="text" placeholder="What was this for?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ width: '100%', background: '#111a0f', border: '1px solid #2a3d28', borderRadius: '8px', padding: '0.5rem 0.7rem', color: 'var(--text)', fontSize: '0.9rem' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem' }}>
            <button onClick={handleAdd} style={{ background: 'var(--accent)', color: '#111', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid #2a3d28', borderRadius: '8px', padding: '0.6rem 1.2rem', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        {filtered.map(e => (
          <div key={e.id} style={{
            background: 'var(--card)',
            border: '1px solid #2a3d28',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem',
            borderLeft: `4px solid ${e.type === 'Income' ? '#4a8c3f' : '#c0392b'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{e.description}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  {e.date} · {e.category}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: e.type === 'Income' ? '#4a8c3f' : '#c0392b', fontSize: '1rem' }}>
                  {e.type === 'Income' ? '+' : '-'}{fmt(e.amount)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Bal: {fmt(e.balance)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
