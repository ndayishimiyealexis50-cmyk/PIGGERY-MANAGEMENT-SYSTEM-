# FarmIQ — Vite + React Migration

## Project Structure

```
farmiq-vite/
├── index.html                    ← Vite entry (replaces the monolith's <head>)
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx                  ← ReactDOM.createRoot() entry
    ├── App.jsx                   ← Root component (replaces §28)
    │
    ├── lib/                      ← Pure utilities — no React
    │   ├── firebase.js           ← Firebase init (replaces §5)
    │   ├── firestore.js          ← fsSet / jbinAppend / getOnlineFarmData etc (replaces §6)
    │   ├── utils.js              ← uid, toDay, fmtRWF, fmtNum, addDays, daysDiff (replaces §1)
    │   ├── pigUtils.js           ← genPigTag, breedCode, autoAddToStock, autoRegisterPigs (replaces §2)
    │   ├── ai.js                 ← askAI / getApiKey / setApiKey (replaces §7)
    │   ├── whatsapp.js           ← sendWhatsApp / sendWhatsAppToNumber etc (replaces §3)
    │   ├── capitalUtils.js       ← capitalTx, calcCapitalBalance (replaces §CapitalTx)
    │   └── constants.js          ← ADMIN_EMAIL, EXPENSE_CATS, INCOME_CATS, MARKETS etc
    │
    ├── styles/
    │   ├── theme.js              ← C (color tokens) and S (style objects) — replaces §8
    │   └── index.css             ← Global CSS (replaces the <style> block in index.html)
    │
    ├── hooks/                    ← Custom React hooks
    │   ├── useSyncStatus.js      ← (replaces §6a)
    │   └── useAutoFeedingTasks.js← (replaces §TaskManager helper)
    │
    ├── components/               ← Shared/UI-only components
    │   ├── PDFBtn.jsx
    │   ├── AIErrorMsg.jsx
    │   ├── ApiKeyModal.jsx
    │   └── Toast.jsx
    │
    └── modules/                  ← One file per feature module
        ├── BonusRequestManager.jsx   ✅ EXTRACTED
        ├── TaskManager.jsx           ✅ EXTRACTED
        ├── VaccinationTracker.jsx    ✅ EXTRACTED
        ├── AIMessages.jsx            ✅ EXTRACTED
        └── ApprovalPanel.jsx         ✅ EXTRACTED
```

---

## Setup

```bash
npm create vite@latest farmiq-vite -- --template react
cd farmiq-vite
npm install
npm install firebase
npm run dev
```

---

## Migration Checklist

### Phase 1 — Scaffolding (this PR)
- [x] Project structure defined
- [x] All 5 modules extracted as proper `.jsx` files with `export default`
- [x] `lib/` layer scaffolded with correct import shapes
- [x] Theme (`C` + `S`) moved to `src/styles/theme.js`
- [x] Firebase moved to `src/lib/firebase.js`

### Phase 2 — Wiring
- [ ] Migrate `App.jsx` (main router/state) from §28
- [ ] Migrate all remaining modules (Dashboard, Payroll, Settings, Auth…)
- [ ] Connect Firebase auth flow
- [ ] Replace `window._addAuditLog` with a proper context/hook
- [ ] Replace `window.prompt` / `window.confirm` with modal components

### Phase 3 — Cleanup
- [ ] Remove `window.*` globals
- [ ] Replace inline style objects with CSS modules or Tailwind
- [ ] Add TypeScript types (optional)
- [ ] PWA config with Vite PWA plugin

---

## Key Differences from Old index.html

| Old (index.html)            | New (Vite)                          |
|-----------------------------|-------------------------------------|
| `const C = {...}`           | `import { C } from '../styles/theme'` |
| `const S = {...}`           | `import { S } from '../styles/theme'` |
| `firebase.firestore()`      | `import { db } from '../lib/firebase'` |
| `fsSet(key, list)`          | `import { fsSet } from '../lib/firestore'` |
| `toDay()` global            | `import { toDay } from '../lib/utils'` |
| `fmtRWF()` global           | `import { fmtRWF } from '../lib/utils'` |
| `isAdminUser()` global      | `import { isAdminUser } from '../lib/constants'` |
| `uid()` global              | `import { uid } from '../lib/utils'` |
| `askAI()` global            | `import { askAI } from '../lib/ai'` |
| `capitalTx()` global        | `import { capitalTx } from '../lib/capitalUtils'` |
| `jbinAppend()` global       | `import { jbinAppend } from '../lib/firestore'` |
| `window._addAuditLog`       | `useAuditLog()` hook (Phase 2)      |
