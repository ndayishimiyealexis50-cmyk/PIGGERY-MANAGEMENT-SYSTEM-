import React, { useState } from "react";
import { fsSet } from "../utils/storage";
import { uid, toDay, fmtRWF, capitalTx } from "../utils/helpers";
import { getMarketPrice } from "../utils/market";

// ── Constants ──
const STAGE_CODE = { Piglet:"P", Weaner:"W", Grower:"G", Finisher:"F", Gilt:"GL", Sow:"S", Boar:"B" };
const BREEDS = ["Landrace","Large White","Duroc","Hampshire","Mixed/Local"];
const STAGES = ["Piglet","Weaner","Grower","Finisher","Gilt","Sow","Boar"];

function breedCode(breed) {
  if (!breed) return "XX";
  const b = breed.trim();
  if (b === "Mixed/Local") return "ML";
  if (b.includes("/")) return b.split("/").map(p => p.trim().slice(0,2).toUpperCase()).join("-");
  const words = b.split(/\s+/).filter(w => w.length > 2);
  if (words.length >= 2) return words.slice(0,2).map(w => w.slice(0,2).toUpperCase()).join("-");
  return b.slice(0,2).toUpperCase();
}

function genPigTag(breed, stage, existingPigs) {
  const now = new Date();
  const yymm = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,"0");
  const sc = STAGE_CODE[stage] || "X";
  const bc = breedCode(breed);
  const sameType = (existingPigs || []).filter(p =>
    breedCode(p.breed) === bc && (STAGE_CODE[p.stage] || "X") === sc
  ).length;
  const seq = String(sameType + 1).padStart(3, "0");
  return `${bc}-${sc}-${yymm}-${seq}`;
}

// ── Growth Modal ──
function GrowthModal({ pig, onSave, onClose }) {
  const [weight, setWeight] = useState(String(pig.weight || ""));
  const [length, setLength] = useState(String(pig.length || ""));
  const today = toDay();

  function save() {
    const w = parseFloat(weight);
    const l = parseFloat(length) || null;
    if (!w || w <= 0) return;
    const newMeasure = { date: today, weight: w, length: l };
    const history = [...(pig.measurements || []), newMeasure];
    onSave({ weight: w, length: l || pig.length, measurements: history });
  }

  const lastM = pig.measurements && pig.measurements.length > 0
    ? pig.measurements[pig.measurements.length - 1] : null;
  const wGain = lastM && parseFloat(weight) > 0
    ? Math.round((parseFloat(weight) - lastM.weight) * 10) / 10 : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:C.surface, border:"1px solid "+C.border, borderRadius:16, padding:24, width:340, boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
        <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>📏 Record Growth — {pig.tag}</div>
        <div style={{ fontSize:11, color:C.faint, marginBottom:16 }}>{pig.breed} · {pig.stage} · Today: {today}</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div>
            <label style={S.lbl}>Weight (kg) *</label>
            <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} style={S.inp} autoFocus />
            {wGain !== null && <div style={{ fontSize:10, marginTop:3, color:wGain>0?C.accent:C.red, fontWeight:600 }}>{wGain>0?"+":""}{wGain}kg since last record</div>}
          </div>
          <div>
            <label style={S.lbl}>Body Length (cm)</label>
            <input type="number" step="0.5" value={length} onChange={e => setLength(e.target.value)} placeholder="e.g. 85" style={S.inp} />
            <div style={{ fontSize:9, color:C.faint, marginTop:2 }}>Tip-to-tail length</div>
          </div>
        </div>
        {pig.measurements && pig.measurements.length > 0 && (
          <div style={{ background:C.elevated, borderRadius:8, padding:"9px 12px", marginBottom:14, fontSize:11 }}>
            <div style={{ fontWeight:600, color:C.text, marginBottom:6 }}>📈 Growth History (last 3)</div>
            {pig.measurements.slice(-3).reverse().map((m, i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", color:C.muted, padding:"2px 0", borderBottom:i<2?"1px solid "+C.border:"none" }}>
                <span>{m.date}</span>
                <span style={{ fontWeight:600, color:C.text }}>{m.weight}kg{m.length?" · "+m.length+"cm":""}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={save} style={{ ...S.btn(C.accent), flex:1, padding:10, fontSize:13 }}>✓ Save Measurement</button>
          <button onClick={onClose} style={{ ...S.btn("#374151"), padding:"10px 14px", fontSize:13 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Long-press hook ──
function useLongPress(onLongPress, ms = 500) {
  const timer = useRef(null);
  function start(e) {
    const el = e.currentTarget;
    timer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate([20, 10, 30]);
      onLongPress();
    }, ms);
  }
  function cancel() { clearTimeout(timer.current); }
  return { onMouseDown:start, onMouseUp:cancel, onMouseLeave:cancel, onTouchStart:start, onTouchEnd:cancel, onTouchMove:cancel };
}

// ── PigCard ──
function PigCard({ p, sc, logs, editPigId, editForm, setEditPigId, setEditForm, saveEdit, setGrowthPig, setPigs, deletePig, onLongPress }) {
  const lpHandlers = useLongPress(onLongPress);
  return (
    <div {...lpHandlers} style={{ ...S.card, marginBottom:0, opacity:p.status==="active"?1:0.55, border:"1px solid "+(p.status==="active"?C.border:"rgba(100,116,139,.2)"), position:"relative", cursor:"default", userSelect:"none" }}>
      {editPigId === p.id && editForm ? (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:C.accent, marginBottom:9 }}>✏️ Edit {p.tag}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:9 }}>
            <div><label style={S.lbl}>Weight (kg)</label><input type="number" value={editForm.weight} onChange={e => setEditForm({...editForm, weight:e.target.value})} style={S.inp}/></div>
            <div><label style={S.lbl}>Length (cm)</label><input type="number" value={editForm.length||""} onChange={e => setEditForm({...editForm, length:e.target.value})} style={S.inp}/></div>
            <div><label style={S.lbl}>Stage</label><select value={editForm.stage} onChange={e => setEditForm({...editForm, stage:e.target.value})} style={S.inp}>{STAGES.map(o => <option key={o}>{o}</option>)}</select></div>
            <div><label style={S.lbl}>Breed</label><select value={editForm.breed} onChange={e => setEditForm({...editForm, breed:e.target.value})} style={S.inp}>{BREEDS.map(o => <option key={o}>{o}</option>)}</select></div>
            <div style={{ gridColumn:"1/-1" }}><label style={S.lbl}>Source</label><input value={editForm.source||""} onChange={e => setEditForm({...editForm, source:e.target.value})} style={S.inp}/></div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={saveEdit} style={{ ...S.btn(C.accent), flex:1, padding:"7px", fontSize:12 }}>✓ Save</button>
            <button onClick={() => { setEditPigId(null); setEditForm(null); }} style={{ ...S.btn("#374151"), padding:"7px", fontSize:12 }}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>🐷 {p.tag}</div>
            <span style={{ padding:"2px 8px", borderRadius:20, background:(sc[p.stage]||C.accent)+"22", color:sc[p.stage]||C.accent, fontSize:10, fontWeight:600 }}>{p.stage}</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, fontSize:11, marginBottom:8 }}>
            {[["Breed",p.breed],["Gender",p.gender],["Weight",p.weight+"kg"],["Length",p.length?(p.length+"cm"):"—"],["Market Val",fmtRWF(p.status==="active"?getMarketPrice(p.stage,p.weight):0)],["Arrived",p.arrivalDate||"—"]].map(([l,v]) => (
              <div key={l} style={{ background:C.elevated, borderRadius:5, padding:"4px 7px" }}>
                <div style={{ color:C.faint, fontSize:9 }}>{l}</div>
                <div style={{ color:l==="Market Val"?C.accent:C.text, marginTop:1, fontWeight:l==="Market Val"?700:400 }}>{v}</div>
              </div>
            ))}
          </div>
          {(p.source || p.batchName) && (
            <div style={{ fontSize:10, color:C.faint, marginBottom:8, padding:"4px 7px", background:C.elevated, borderRadius:5 }}>
              {p.source && <span>📍 {p.source}</span>}{p.source && p.batchName && " · "}{p.batchName && <span>📦 {p.batchName}</span>}
            </div>
          )}
          {p.measurements && p.measurements.length > 1 && (() => {
            const hist = p.measurements;
            const last = hist[hist.length - 1];
            const prev = hist[hist.length - 2];
            const gain = Math.round((last.weight - prev.weight) * 10) / 10;
            return (
              <div style={{ fontSize:10, color:gain>=0?C.accent:C.red, marginBottom:8, padding:"3px 7px", background:gain>=0?C.accentSoft:"rgba(239,68,68,.06)", borderRadius:5, fontWeight:600 }}>
                📈 Last gain: {gain>=0?"+":""}{gain}kg · {last.date}
              </div>
            );
          })()}
          <div style={{ display:"flex", gap:5, marginBottom:6 }}>
            {p.status === "active" && (
              <button onClick={() => setGrowthPig(p)} style={{ flex:1, padding:"5px", borderRadius:6, border:"1px solid "+C.border, background:C.accentSoft, color:C.accent, fontSize:10, cursor:"pointer", fontWeight:600 }}>📏 Record Growth</button>
            )}
            <button
              onClick={() => setPigs(prev => { const updated = prev.map(pig => pig.id===p.id ? {...pig, status:pig.status==="active"?"sold":"active"} : pig); fsSet("pigs", updated); return updated; })}
              style={{ flex:1, padding:5, borderRadius:6, border:"1px solid "+C.border, background:"transparent", color:C.faint, fontSize:10, cursor:"pointer" }}>
              {p.status === "active" ? "Mark Sold" : "Reactivate"}
            </button>
          </div>
          <div style={{ display:"flex", gap:5 }}>
            <button onClick={() => { setEditPigId(p.id); setEditForm({ weight:String(p.weight), length:String(p.length||""), stage:p.stage, breed:p.breed, source:p.source||"" }); }}
              style={{ flex:1, padding:"4px", borderRadius:6, border:"1px solid "+C.border, background:"transparent", color:C.muted, fontSize:10, cursor:"pointer" }}>✏️ Edit</button>
            <button onClick={() => deletePig(p)}
              style={{ flex:1, padding:"4px", borderRadius:6, border:"1px solid rgba(239,68,68,.3)", background:"transparent", color:C.red, fontSize:10, cursor:"pointer" }}>🗑️ Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Pigs Component ──
export default function Pigs({ pigs, setPigs, logs, allData, capital, setCapital }) {
  function makeBlankForm(breed = "Landrace", stage = "Piglet", existingPigs) {
    return { tag:genPigTag(breed, stage, existingPigs||pigs), breed, gender:"Female", stage, weight:"", length:"", dob:"", arrivalDate:toDay(), source:"", batchName:"", purchasePrice:"" };
  }

  const [mode, setMode] = useState(null);
  const [form, setForm] = useState(() => makeBlankForm());
  const [batchCount, setBatchCount] = useState("5");
  const [batchRows, setBatchRows] = useState([]);
  const [saved, setSaved] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [undoBanner, setUndoBanner] = useState(null);
  const [growthPig, setGrowthPig] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [editPigId, setEditPigId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [longPressedPig, setLongPressedPig] = useState(null);

  function initBatch() {
    const n = parseInt(batchCount) || 5;
    const rows = Array.from({ length: n }, (_, i) => {
      const breed = "Landrace", stage = "Piglet";
      return { tag:genPigTag(breed, stage, [...pigs, ...Array(i).fill({breed,stage})]), breed, gender:"Female", stage, weight:"", length:"", dob:"", arrivalDate:toDay(), source:"", batchName:"", purchasePrice:"", id:uid() };
    });
    setBatchRows(rows);
  }

  function addSingle() {
    if (!form.tag.trim()) { alert("Tag is required"); return; }
    const price = parseFloat(form.purchasePrice) || 0;
    const newPig = { ...form, id:uid(), weight:parseFloat(form.weight)||0, length:parseFloat(form.length)||null, status:"active", measurements:[] };
    setPigs(p => { const updated = [...p, newPig]; fsSet("pigs", updated); return updated; });
    if (setCapital && price > 0) {
      capitalTx(capital, setCapital, { type:"expense", category:"Pig Purchase", amount:price, description:`Pig ${form.tag} (${form.stage}, ${form.weight||0}kg) from ${form.source||"unknown source"}`, date:form.arrivalDate||toDay() });
    }
    setForm(makeBlankForm()); setMode(null); setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  function addBatch() {
    const valid = batchRows.filter(r => r.tag.trim());
    if (!valid.length) { alert("Fill in at least one tag"); return; }
    const totalPrice = valid.reduce((s, r) => s + (parseFloat(r.purchasePrice)||0), 0);
    const newPigs = valid.map(r => ({ ...r, weight:parseFloat(r.weight)||0, length:parseFloat(r.length)||null, status:"active", measurements:[] }));
    setPigs(p => { const updated = [...p, ...newPigs]; fsSet("pigs", updated); return updated; });
    if (setCapital && totalPrice > 0) {
      capitalTx(capital, setCapital, { type:"expense", category:"Pig Purchase", amount:totalPrice, description:`Batch registration: ${valid.length} pigs (${valid[0].batchName||"no batch name"})`, date:valid[0].arrivalDate||toDay() });
    }
    setBatchRows([]); setMode(null); setSaved(true); setTimeout(() => setSaved(false), 3000);
  }

  function deletePig(pig) {
    setUndoStack(prev => [...prev, { pig, timestamp:Date.now() }]);
    setPigs(prev => { const updated = prev.filter(p => p.id !== pig.id); fsSet("pigs", updated); return updated; });
    setUndoBanner(pig.id);
    setTimeout(() => setUndoBanner(null), 8000);
  }

  function undoDelete(pigId) {
    const entry = undoStack.find(u => u.pig.id === pigId);
    if (!entry) return;
    setPigs(prev => { const updated = [...prev, entry.pig]; fsSet("pigs", updated); return updated; });
    setUndoStack(prev => prev.filter(u => u.pig.id !== pigId));
    setUndoBanner(null);
  }

  function saveGrowth(pigId, updates) {
    setPigs(prev => { const updated = prev.map(p => p.id===pigId ? {...p,...updates} : p); fsSet("pigs", updated); return updated; });
    setGrowthPig(null);
  }

  function saveEdit() {
    if (!editForm) return;
    setPigs(prev => { const updated = prev.map(p => p.id===editPigId ? {...p,...editForm, weight:parseFloat(editForm.weight)||p.weight, length:parseFloat(editForm.length)||p.length} : p); fsSet("pigs", updated); return updated; });
    setEditPigId(null); setEditForm(null);
  }

  const sc = { Piglet:"#a78bfa", Weaner:"#60a5fa", Grower:"#10b981", Finisher:C.amber, Gilt:C.pink, Sow:C.red, Boar:"#fb923c" };
  const activePigs = pigs.filter(p => p.status === "active");
  const filtered = pigs.filter(p => {
    if (filterStage && p.stage !== filterStage) return false;
    if (searchQ) { const q = searchQ.toLowerCase(); return (p.tag||"").toLowerCase().includes(q)||(p.breed||"").toLowerCase().includes(q)||(p.source||"").toLowerCase().includes(q)||(p.batchName||"").toLowerCase().includes(q); }
    return true;
  });

  return (
    <div>
      {growthPig && <GrowthModal pig={growthPig} onSave={u => saveGrowth(growthPig.id, u)} onClose={() => setGrowthPig(null)} />}

      {undoBanner && (
        <div style={{ position:"fixed", bottom:24, left:"50%", transform:"translateX(-50%)", zIndex:9990, display:"flex", alignItems:"center", gap:12, background:"#1e293b", color:"#fff", padding:"12px 18px", borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,.3)", fontSize:13 }}>
          🗑️ Pig deleted.
          <button onClick={() => undoDelete(undoBanner)} style={{ padding:"5px 14px", borderRadius:7, border:"none", background:C.accent, color:"#fff", fontWeight:700, fontSize:12, cursor:"pointer" }}>↩ Undo</button>
          <button onClick={() => setUndoBanner(null)} style={{ background:"none", border:"none", color:"rgba(255,255,255,.5)", cursor:"pointer", fontSize:16 }}>×</button>
        </div>
      )}

      {saved && <div style={{ padding:"11px 14px", background:C.accentSoft, border:"1px solid rgba(22,163,74,.3)", borderRadius:9, marginBottom:14, color:C.accent, fontWeight:600 }}>✅ Pig(s) registered successfully!</div>}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={S.h1}>🐷 Pig Records</div>
          <div style={S.sub}>{activePigs.length} active · {pigs.filter(p => p.status==="sold").length} sold</div>
        </div>
        <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
          <button style={S.btn()} onClick={() => setMode(mode==="single"?null:"single")}>+ Add Pig</button>
          <button style={{ ...S.btn("#1d4ed8") }} onClick={() => { setMode(mode==="batch"?null:"batch"); initBatch(); }}>📋 Batch Register</button>
        </div>
      </div>

      {/* SINGLE PIG FORM */}
      {mode === "single" && (
        <div style={{ ...S.card, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.accent, marginBottom:4 }}>➕ Register New Pig</div>
          <div style={{ fontSize:11, color:C.faint, marginBottom:12 }}>Tag is auto-generated. Change breed/stage to regenerate.</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:12 }}>
            <div>
              <label style={S.lbl}>Auto-Generated Tag</label>
              <div style={{ display:"flex", gap:5 }}>
                <input value={form.tag} onChange={e => setForm({...form, tag:e.target.value})} style={{ ...S.inp, fontWeight:700, fontFamily:"monospace", fontSize:12, flex:1 }} />
                <button onClick={() => setForm(f => ({...f, tag:genPigTag(f.breed, f.stage, pigs)}))} style={{ padding:"6px 9px", borderRadius:7, border:"1px solid rgba(22,163,74,.4)", background:"rgba(22,163,74,.07)", color:C.accent, cursor:"pointer", fontSize:13, flexShrink:0 }}>🔄</button>
              </div>
            </div>
            <div><label style={S.lbl}>Weight (kg)</label><input type="number" step="0.1" value={form.weight} onChange={e => setForm({...form, weight:e.target.value})} style={S.inp} /></div>
            <div><label style={S.lbl}>Length (cm)</label><input type="number" step="0.5" value={form.length} onChange={e => setForm({...form, length:e.target.value})} placeholder="e.g. 85" style={S.inp} /></div>
            <div><label style={S.lbl}>Breed</label><select value={form.breed} onChange={e => { const b=e.target.value; setForm(f=>({...f, breed:b, tag:genPigTag(b,f.stage,pigs)})); }} style={S.inp}>{BREEDS.map(o => <option key={o}>{o}</option>)}</select></div>
            <div><label style={S.lbl}>Gender</label><select value={form.gender} onChange={e => setForm({...form, gender:e.target.value})} style={S.inp}><option>Female</option><option>Male</option></select></div>
            <div><label style={S.lbl}>Stage</label><select value={form.stage} onChange={e => { const s=e.target.value; setForm(f=>({...f, stage:s, tag:genPigTag(f.breed,s,pigs)})); }} style={S.inp}>{STAGES.map(o => <option key={o}>{o}</option>)}</select></div>
            <div><label style={S.lbl}>Date of Birth</label><input type="date" value={form.dob} onChange={e => setForm({...form, dob:e.target.value})} style={S.inp} /></div>
            <div><label style={S.lbl}>Arrival Date</label><input type="date" value={form.arrivalDate} onChange={e => setForm({...form, arrivalDate:e.target.value})} style={S.inp} /></div>
            <div><label style={S.lbl}>Source Farm / Supplier</label><input placeholder="e.g. Musanze Farm" value={form.source} onChange={e => setForm({...form, source:e.target.value})} style={S.inp} /></div>
            <div><label style={S.lbl}>Batch Name (optional)</label><input placeholder="e.g. Batch-2025-A" value={form.batchName} onChange={e => setForm({...form, batchName:e.target.value})} style={S.inp} /></div>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={S.lbl}>Purchase Price (RWF) — deducted from capital</label>
              <input type="number" placeholder="e.g. 35000" value={form.purchasePrice} onChange={e => setForm({...form, purchasePrice:e.target.value})} style={S.inp} />
              {form.purchasePrice && parseFloat(form.purchasePrice) > 0 && <div style={{ fontSize:11, color:C.red, marginTop:3 }}>💰 {fmtRWF(parseFloat(form.purchasePrice))} will be recorded as Pig Purchase expense</div>}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.btn(), flex:1, padding:11 }} onClick={addSingle}>✅ Register Pig</button>
            <button style={S.btn("#374151")} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* BATCH REGISTRATION FORM */}
      {mode === "batch" && (
        <div style={{ ...S.card, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#1d4ed8", marginBottom:4 }}>📋 Batch Pig Registration</div>
          <div style={{ fontSize:12, color:C.faint, marginBottom:12 }}>Register multiple pigs arriving together (same batch/source)</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12, padding:"12px", background:"rgba(29,78,216,.04)", borderRadius:9, border:"1px solid rgba(29,78,216,.15)" }}>
            <div>
              <label style={S.lbl}>Number of Pigs</label>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <input type="number" min="1" max="50" value={batchCount} onChange={e => setBatchCount(e.target.value)} style={{ ...S.inp, width:70 }} />
                <button onClick={initBatch} style={{ ...S.btn("#1d4ed8"), fontSize:11, padding:"8px 12px", flexShrink:0 }}>Generate</button>
              </div>
            </div>
            <div><label style={S.lbl}>Batch Name</label><input placeholder="e.g. Batch-2025-A" value={form.batchName} onChange={e => { setForm({...form, batchName:e.target.value}); setBatchRows(r => r.map(row => ({...row, batchName:e.target.value}))); }} style={S.inp} /></div>
            <div><label style={S.lbl}>Arrival Date</label><input type="date" value={form.arrivalDate} onChange={e => { setForm({...form, arrivalDate:e.target.value}); setBatchRows(r => r.map(row => ({...row, arrivalDate:e.target.value}))); }} style={S.inp} /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={S.lbl}>Source Farm / Supplier (applies to all)</label><input placeholder="e.g. Musanze Farm Co-op" value={form.source} onChange={e => { setForm({...form, source:e.target.value}); setBatchRows(r => r.map(row => ({...row, source:e.target.value}))); }} style={S.inp} /></div>
          </div>
          {batchRows.length > 0 && (
            <div style={{ overflowX:"auto", marginBottom:12 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ background:C.elevated }}>
                  {["Tag *","Breed","Gender","Stage","Weight (kg)","Length (cm)","Price (RWF)"].map(h => <th key={h} style={{ padding:"7px 8px", textAlign:"left", color:C.faint, fontWeight:600, fontSize:10, borderBottom:"1px solid "+C.border }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {batchRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom:"1px solid "+C.elevated }}>
                      <td style={{ padding:"4px 6px" }}><input value={row.tag} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,tag:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }} /></td>
                      <td style={{ padding:"4px 6px" }}><select value={row.breed} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,breed:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }}>{BREEDS.map(o => <option key={o}>{o}</option>)}</select></td>
                      <td style={{ padding:"4px 6px" }}><select value={row.gender} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,gender:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }}><option>Female</option><option>Male</option></select></td>
                      <td style={{ padding:"4px 6px" }}><select value={row.stage} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,stage:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }}>{STAGES.map(o => <option key={o}>{o}</option>)}</select></td>
                      <td style={{ padding:"4px 6px" }}><input type="number" value={row.weight} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,weight:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }} placeholder="0" /></td>
                      <td style={{ padding:"4px 6px" }}><input type="number" value={row.length} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,length:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }} placeholder="0" /></td>
                      <td style={{ padding:"4px 6px" }}><input type="number" value={row.purchasePrice} onChange={e => setBatchRows(r => r.map((x,j) => j===i?{...x,purchasePrice:e.target.value}:x))} style={{ ...S.inp, padding:"5px 7px", fontSize:12 }} placeholder="0" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {batchRows.reduce((s,r) => s+(parseFloat(r.purchasePrice)||0), 0) > 0 && (
                <div style={{ marginTop:8, fontSize:12, color:C.red, fontWeight:600 }}>💰 Total batch cost: {fmtRWF(batchRows.reduce((s,r) => s+(parseFloat(r.purchasePrice)||0), 0))}</div>
              )}
            </div>
          )}
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...S.btn("#1d4ed8"), flex:1, padding:11 }} onClick={addBatch} disabled={!batchRows.length}>✅ Register {batchRows.filter(r => r.tag.trim()).length} Pig(s)</button>
            <button style={S.btn("#374151")} onClick={() => setMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* SEARCH + FILTER */}
      {pigs.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:14 }}>
          <input placeholder="🔍 Search by tag, breed, source, batch…" value={searchQ} onChange={e => setSearchQ(e.target.value)} style={S.inp} />
          <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ ...S.inp, width:"auto" }}>
            <option value="">All Stages</option>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      )}

      {/* LONG-PRESS QUICK MENU */}
      {longPressedPig && (
        <div style={{ position:"fixed", inset:0, zIndex:3000, background:"rgba(0,0,0,.5)", backdropFilter:"blur(4px)", display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => setLongPressedPig(null)}>
          <div style={{ background:"#fff", borderRadius:20, padding:22, width:270, boxShadow:"0 24px 60px rgba(0,0,0,.28)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:4 }}>🐷 {longPressedPig.tag}</div>
            <div style={{ fontSize:11, color:C.faint, marginBottom:16 }}>{longPressedPig.breed} · {longPressedPig.stage} · {longPressedPig.weight}kg · {fmtRWF(getMarketPrice(longPressedPig.stage, longPressedPig.weight))}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { icon:"📏", label:"Record Growth", color:C.accent, action:() => { setGrowthPig(longPressedPig); setLongPressedPig(null); } },
                { icon:"✏️", label:"Edit Pig", color:C.blue||"#3b82f6", action:() => { setEditPigId(longPressedPig.id); setEditForm({ weight:String(longPressedPig.weight), length:String(longPressedPig.length||""), stage:longPressedPig.stage, breed:longPressedPig.breed, source:longPressedPig.source||"" }); setLongPressedPig(null); } },
                { icon:"🏷️", label:"Mark as Sold", color:C.amber||"#f59e0b", action:() => { setPigs(prev => { const u=prev.map(pig=>pig.id===longPressedPig.id?{...pig,status:"sold"}:pig); fsSet("pigs",u); return u; }); setLongPressedPig(null); } },
                { icon:"🗑️", label:"Delete Pig", color:C.red||"#ef4444", action:() => { deletePig(longPressedPig); setLongPressedPig(null); } },
                { icon:"✕", label:"Cancel", color:C.muted||"#94a3b8", action:() => setLongPressedPig(null) },
              ].map(a => (
                <button key={a.label} onClick={a.action} style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1px solid "+(a.color+"33"), background:a.color+"0d", color:a.color, fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:16 }}>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PIG CARDS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))", gap:12 }}>
        {filtered.map(p => (
          <PigCard key={p.id} p={p} sc={sc} logs={logs}
            editPigId={editPigId} editForm={editForm}
            setEditPigId={setEditPigId} setEditForm={setEditForm}
            saveEdit={saveEdit} setGrowthPig={setGrowthPig}
            setPigs={setPigs} deletePig={deletePig}
            onLongPress={() => setLongPressedPig(p)} />
        ))}
      </div>
      {filtered.length === 0 && pigs.length > 0 && (
        <div style={{ ...S.card, textAlign:"center", color:C.faint, padding:30 }}>No pigs match your search/filter.</div>
      )}
      {pigs.length === 0 && (
        <div style={{ ...S.card, textAlign:"center", padding:40 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🐷</div>
          <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>No pigs registered yet</div>
          <div style={{ color:C.faint, fontSize:13, marginBottom:16 }}>Tap "+ Add Pig" to register your first pig</div>
          <button style={{ ...S.btn(), padding:"10px 24px" }} onClick={() => setMode("single")}>+ Add First Pig</button>
        </div>
      )}
    </div>
  );
}
