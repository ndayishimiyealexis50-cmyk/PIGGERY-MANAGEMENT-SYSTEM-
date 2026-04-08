import { useState } from 'react'

const initialLogs = [
  { id: 1, date: '2026-04-07', pig: 'Pig #001', weight: '45kg', feed: '2.5kg', health: 'Good', notes: 'Active, eating well' },
  { id: 2, date: '2026-04-07', pig: 'Pig #002', weight: '42kg', feed: '2.2kg', health: 'Good', notes: 'Normal behavior' },
  { id: 3, date: '2026-04-06', pig: 'Pig #003', weight: '38kg', feed: '2.0kg', health: 'Monitor', notes: 'Slightly lethargic' },
]

const healthColors = {
  Good: '#4a8c3f',
  Monitor: '#f5c842',
  Sick: '#c0392b',
}

export default function DailyLog() {
  const [logs, setLogs] = useState(initialLogs)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    pig: '',
    weight: '',
    feed: '',
    health: 'Good',
    notes: ''
  })

  const handleAdd = () => {
    if (!form.pig || !form.weight) return
    setLogs([{ id: Date.now(), ...form }, ...logs])
    setForm({ date: new Date().toISOString().split('T')[0], pig: '', weight: '', feed: '', health: 'Good', notes: '' })
    setShowForm(false)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem' }}>📋 Daily Log</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Track daily pig activity & health</p>
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
          + Add Log
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid #2a3d28',
          borderRadius: '14px',
          padding: '1.2rem',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>New Log Entry</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            {[
              { label: 'Date', key: 'date', type: 'date' },
              { label: 'Pig ID', key: 'pig', type: 'text', placeholder: 'e.g. Pig #004' },
              { label: 'Weight', key: 'weight', type: 'text', placeholder: 'e.g. 40kg' },
              { label: 'Feed Given', key: 'feed', type: 'text', placeholder: 'e.g. 2.0kg' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#111a0f',
                    border: '1px solid #2a3d28',
                    borderRadius: '8px',
                    padding: '0.5rem 0.7rem',
                    color: 'var(--text)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Health Status</label>
              <select
                value={form.health}
                onChange={e => setForm({ ...form, health: e.target.value })}
                style={{
                  width: '100%',
                  background: '#111a0f',
                  border: '1px solid #2a3d28',
                  borderRadius: '8px',
                  padding: '0.5rem 0.7rem',
                  color: 'var(--text)',
                  fontSize: '0.9rem'
                }}
              >
                <option>Good</option>
                <option>Monitor</option>
                <option>Sick</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Notes</label>
              <input
                type="text"
                placeholder="Any observations..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                style={{
                  width: '100%',
                  background: '#111a0f',
                  border: '1px solid #2a3d28',
                  borderRadius: '8px',
                  padding: '0.5rem 0.7rem',
                  color: 'var(--text)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1rem' }}>
            <button
              onClick={handleAdd}
              style={{
                background: 'var(--accent)',
                color: '#111',
                border: 'none',
                borderRadius: '8px',
                padding: '0.6rem 1.2rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'transparent',
                color: 'var(--muted)',
                border: '1px solid #2a3d28',
                borderRadius: '8px',
                padding: '0.6rem 1.2rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Log List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {logs.map(log => (
          <div
            key={log.id}
            style={{
              background: 'var(--card)',
              border: '1px solid #2a3d28',
              borderRadius: '14px',
              padding: '1rem 1.2rem',
              borderLeft: `4px solid ${healthColors[log.health] || '#4a8c3f'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>{log.pig}</span>
              <span style={{
                background: healthColors[log.health] + '33',
                color: healthColors[log.health],
                borderRadius: '20px',
                padding: '0.2rem 0.7rem',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {log.health}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
              <span>📅 {log.date}</span>
              <span>⚖️ {log.weight}</span>
              <span>🌾 {log.feed}</span>
            </div>
            {log.notes && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                💬 {log.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
