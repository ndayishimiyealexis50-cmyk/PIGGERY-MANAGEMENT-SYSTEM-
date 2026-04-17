import { useState } from "react";
import { C, S, toDay } from "../utils";
import { getBusinessProfile } from "../utils";

// ─── PDF Download ───
function buildPDFHTML(type, data) {
  const { pigs = [], feeds = [], sales = [], logs = [], expenses = [], incomes = [] } = data;
  const biz = getBusinessProfile();
  const active = pigs.filter(p => p.status === "active");
  const totalInc = sales.reduce((s, l) => s + (l.total || 0), 0) + incomes.reduce((s, l) => s + (l.amount || 0), 0);
  const totalExp = feeds.reduce((s, l) => s + (l.cost || 0), 0) + expenses.reduce((s, l) => s + (l.amount || 0), 0);

  const style = `body{font-family:sans-serif;padding:32px;color:#111;max-width:800px;margin:0 auto}
    h1{color:#16a34a}h2{color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:1px solid #e5e7eb;padding:8px 12px;font-size:13px;text-align:left}
    th{background:#f0fdf4;color:#166534;font-weight:700}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700}
    .green{background:#dcfce7;color:#166534}.red{background:#fee2e2;color:#991b1b}
    .amber{background:#fef3c7;color:#92400e}.footer{margin-top:32px;font-size:11px;color:#6b7280}`;

  let body = `<h1>🐷 ${biz.name || "FarmIQ"} — ${type === "health" ? "Health & Feeding" : "Finance"} Report</h1>
    <p style="color:#6b7280;font-size:13px">Generated: ${new Date().toLocaleString()} · Active pigs: ${active.length}</p>`;

  if (type === "health") {
    body += `<h2>🌾 Feeding Summary</h2>
      <table><tr><th>Date</th><th>Feed Type</th><th>Kg</th><th>Cost (RWF)</th><th>Worker</th></tr>
      ${feeds.slice(-30).reverse().map(f => `<tr><td>${f.date}</td><td>${f.feedType || "—"}</td><td>${f.kg}</td><td>${(f.cost || 0).toLocaleString()}</td><td>${f.worker || "—"}</td></tr>`).join("")}
      </table>
      <h2>📋 Daily Logs</h2>
      <table><tr><th>Date</th><th>Worker</th><th>Sick</th><th>Deaths</th><th>Notes</th></tr>
      ${logs.slice(-20).reverse().map(l => `<tr><td>${l.date}</td><td>${l.worker}</td><td>${l.sick || 0}</td><td>${l.deaths || 0}</td><td>${l.notes || "—"}</td></tr>`).join("")}
      </table>`;
  } else {
    body += `<h2>💰 Sales</h2>
      <table><tr><th>Date</th><th>Pig Tag</th><th>Buyer</th><th>Weight</th><th>Total (RWF)</th></tr>
      ${sales.slice(-30).reverse().map(s => `<tr><td>${s.date}</td><td>${s.pigTag || "—"}</td><td>${s.buyer || "—"}</td><td>${s.weight || "—"}kg</td><td>${(s.total || 0).toLocaleString()}</td></tr>`).join("")}
      </table>
      <h2>📊 Summary</h2>
      <table><tr><th>Total Income</th><th>Total Expenses</th><th>Net Profit</th></tr>
      <tr><td>RWF ${totalInc.toLocaleString()}</td><td>RWF ${totalExp.toLocaleString()}</td>
      <td><span class="badge ${totalInc - totalExp >= 0 ? "green" : "red"}">RWF ${(totalInc - totalExp).toLocaleString()}</span></td></tr>
      </table>`;
  }

  body += `<div class="footer">FarmIQ — AI Pig Farm Management · ${biz.name || ""} · Printed ${toDay()}</div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${style}</style></head><body>${body}</body></html>`;
}

function downloadPDF(type, data, label) {
  const html = buildPDFHTML(type, data);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FarmIQ_${type}_${toDay()}.html`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 3000);
}

// ─── PDF Button Component ───
export default function PDFBtn({ label, type, getData, icon, color }) {
  const [busy, setBusy] = useState(false);
  function go() {
    setBusy(true);
    try { downloadPDF(type, getData(), label); }
    catch (e) { alert("PDF error: " + e.message); }
    setBusy(false);
  }
  return (
    <button
      style={{ ...S.btn(color || C.purple), display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "7px 13px" }}
      onClick={go}
      disabled={busy}
    >
      {busy ? <span className="spin" style={S.loader} /> : <span>{icon || "📄"}</span>}
      {busy ? "Opening…" : label}
    </button>
  );
}
