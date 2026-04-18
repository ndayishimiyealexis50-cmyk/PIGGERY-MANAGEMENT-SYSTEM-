import { C, S } from '../styles/theme';
import { fsSet } from '../lib/firestore';
import React from 'react';
import { C, S } from '../utils/constants';
import { isAdminUser } from '../utils/helpers';
import AIPrediction from './AIPrediction';
import PDFBtn from './PDFBtn';

export default function DLogs({ logs, setLogs, pigs, feeds, sales, expenses, incomes, allData, user }) {
  const isAdmin = isAdminUser(user);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div>
          <div style={S.h1}>Daily Farm Logs</div>
          <div style={S.sub}>{logs.length} reports</div>
        </div>
        <PDFBtn label="Health PDF" type="health" getData={() => allData} icon="📋" color="#374151" />
      </div>

      {logs.length === 0 && <div style={{ ...S.card, color: C.faint, fontSize: 13 }}>No logs yet.</div>}

      {logs.slice().reverse().map((log, i) => (
        <div key={i} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 9 }}>
            <div style={{ fontWeight: 700 }}>{log.worker}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: C.faint }}>{log.date}</span>
              {isAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm('Delete this log?')) {
                      const u = logs.filter(l => l.id !== log.id);
                      setLogs(u);
                      fsSet('logs', u);
                    }
                  }}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,.3)', background: 'transparent', color: C.red, cursor: 'pointer', fontFamily: 'inherit' }}
                >🗑️</button>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 7 }}>
            {[['Checked', log.checked], ['Sick', log.sick], ['Deaths', log.deaths], ['Births', log.births], ['Water', log.water ? '✓' : '✗'], ['Cleaned', log.cleaned ? '✓' : '✗']].map(([l, v]) => (
              <div key={l} style={{ background: C.elevated, borderRadius: 5, padding: '5px 9px' }}>
                <div style={{ fontSize: 9, color: C.faint }}>{l}</div>
                <div style={{ color: (l === 'Sick' || l === 'Deaths') && v > 0 ? C.red : C.text, marginTop: 2, fontSize: 12 }}>{v}</div>
              </div>
            ))}
          </div>
          {log.notes && (
            <div style={{ padding: '7px 11px', background: C.elevated, borderRadius: 6, fontSize: 12, color: C.muted, fontStyle: 'italic' }}>"{log.notes}"</div>
          )}
        </div>
      ))}

      {logs.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, margin: '6px 0 12px' }}>✦ AI Health Analysis</div>
          <AIPrediction pigs={pigs} feeds={feeds} sales={sales} logs={logs} expenses={expenses} incomes={incomes} topic="Disease pattern analysis, mortality risk, vaccination schedule, biosecurity improvements." label="Daily Health Insight" icon="📋" />
        </>
      )}
    </div>
  );
}
