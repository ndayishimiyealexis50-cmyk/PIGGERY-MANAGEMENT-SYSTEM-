import { useState } from 'react'

const initialRecords = [
  {
    id: 1,
    sow: 'Sow #001',
    boar: 'Boar #A1',
    matingDate: '2026-02-10',
    expectedFarrowing: '2026-06-04',
    status: 'Pregnant',
    litterSize: null,
    notes: 'Second pregnancy, healthy'
  },
  {
    id: 2,
    sow: 'Sow #002',
    boar: 'Boar #A2',
    matingDate: '2026-01-15',
    expectedFarrowing: '2026-05-10',
    status: 'Farrowed',
    litterSize: 10,
    notes: '10 piglets born, all healthy'
  },
  {
    id: 3,
    sow: 'Sow #003',
    boar: 'Boar #A1',
    matingDate: '2026-03-20',
    expectedFarrowing: '2026-07-13',
    status: 'Mated',
    litterSize: null,
    notes: 'Monitoring for confirmation'
  },
]

const statusColors = {
  Mated: '#f5c842',
  Pregnant: '#4a8c3f',
  Farrowed: '#3498db',
  Failed: '#c0392b',
}

export default function Reproduction() {
  const [records, setRecords] = useState(initialRecords)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    sow: '',
    boar: '',
    matingDate: new Date().toISOString().split('T')[0],
    expectedFarrowing: '',
    status: 'Mated',
    litterSize: '',
    notes: ''
  })

  // Auto-calculate expected farrowing (114 days gestation)
  const handleMatingDate = (date) => {
    const d = new Date(date)
    d.setDate(d.getDate() + 114)
    const expected = d.toISOString().split('T')[0]
    setForm({ ...form, matingDate: date, expectedFarrowing: expected })
  }

  const handleAdd = () => {
    if (!form.sow || !form.matingDate) return
    setRecords([{ id: Date.now(), ...form }, ...records])
    setForm({
      sow: '', boar: '', matingDate: new Date().toISOString().split('T')[0],
      expectedFarrowing: '', status: 'Mated', litterSize: '', notes: ''
    })
    setShowForm(false)
  }

  const stats = {
    total: records.length,
    pregnant: records.filter(r => r.status === 'Pregnant').length,
    farrowed: records.filter(r => r.status === 'Farrowed').length,
    avgLitter: records.filter(r => r.litterSize).length
      ? Math.round(records.filter(r => r.litterSize).reduce((a, r) => a + r.litterSize, 0) / records.filter(r => r.litterSize).length)
      : 0
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.8rem' }}>🐣 Reproduction</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Mating, pregnancy & farrowing records</p>
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
          + Add Record
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.8rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Records', value: stats.total, icon: '📁' },
          { label: 'Pregnant', value: stats.pregnant, icon: '🤰' },
          { label: 'Farrowed', value: stats.farrowed, icon: '🐷' },
          { label: 'Avg Litter', value: stats.avgLitter || '—', icon: '🐽' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--card)',
            border: '1px solid #2a3d28',
            borderRadius: '12px',
            padding: '0.9rem 0.7rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '1.3rem' }}>{s.icon}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)' }}>{s.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{s.label}</div>
          </div>
        ))}
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
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>New Reproduction Record</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
            {[
              { label: 'Sow ID', key: 'sow', type: 'text', placeholder: 'e.g. Sow #004' },
              { label: 'Boar ID', key: 'boar', type: 'text', placeholder: 'e.g. Boar #A3' },
              { label: 'Litter Size (if farrowed)', key: 'litterSize', type: 'number', placeholder: 'e.g. 9' },
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
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Mating Date</label>
              <input
                type="date"
                value={form.matingDate}
                onChange={e => handleMatingDate(e.target.value)}
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
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Expected Farrowing (auto)</label>
              <input
                type="date"
                value={form.expectedFarrowing}
                readOnly
                style={{
                  width: '100%',
                  background: '#0d150c',
                  border: '1px solid #2a3d28',
                  borderRadius: '8px',
                  padding: '0.5rem 0.7rem',
                  color: 'var(--accent)',
                  fontSize: '0.9rem'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginBottom: '0.3rem' }}>Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
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
                <option>Mated</option>
                <option>Pregnant</option>
                <option>Farrowed</option>
                <option>Failed</option>
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

      {/* Records List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {records.map(r => (
          <div
            key={r.id}
            style={{
              background: 'var(--card)',
              border: '1px solid #2a3d28',
              borderRadius: '14px',
              padding: '1rem 1.2rem',
              borderLeft: `4px solid ${statusColors[r.status] || '#4a8c3f'}`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700 }}>{r.sow} × {r.boar}</span>
              <span style={{
                background: statusColors[r.status] + '33',
                color: statusColors[r.status],
                borderRadius: '20px',
                padding: '0.2rem 0.8rem',
                fontSize: '0.75rem',
                fontWeight: 600
              }}>
                {r.status}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
              <span>🗓 Mated: {r.matingDate}</span>
              <span>🐣 Expected: {r.expectedFarrowing}</span>
              {r.litterSize && <span>🐽 Litter: {r.litterSize} piglets</span>}
            </div>
            {r.notes && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                💬 {r.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
