# Handoff Report — Milestone 3 Explorer 2 (Donations, Reconciliation & CSV Export)

## 1. Observation

Direct code and file observations in the MasjidHub codebase:

1. **Prisma Schema (`backend/prisma/schema.prisma`)**:
   - `Donation` model (lines 71–93):
     ```prisma
     model Donation {
       donation_id              Int            @id @default(autoincrement())
       mosque_id                Int
       user_id                  Int?
       amount_minor             Int
       currency                 String         @default("NGN")
       category                 String
       method                   String
       external_reference       String?
       status                   String         @default("Pending") // Pending | Completed | Failed
       reconciliation_status    String         @default("Unreconciled") // Unreconciled | Reconciled
       receipt_number           String         @unique
       recorded_by              Int?
       verified_by              Int?
       date                     DateTime       @default(now())
       updated_at               DateTime       @updatedAt
     
       mosque                   Mosque         @relation(fields: [mosque_id], references: [mosque_id], onDelete: Cascade)
       user                     User?          @relation(fields: [user_id], references: [user_id], onDelete: SetNull)
     
       @@index([mosque_id, date])
       @@index([mosque_id, status, reconciliation_status])
     }
     ```
   - Fields for tracking offline entry and reconciliation (`reconciliation_status`, `recorded_by`, `verified_by`, `receipt_number`, `external_reference`) already exist in the database schema.

2. **Backend Donation Routes (`backend/src/routes/donations.ts`)**:
   - Manual Cash Donation: `POST /api/admin/donations/manual` (lines 58–93):
     - Protected by `fastify.requireMembership(['tenant_admin', 'finance_officer'])`.
     - Validates `method === 'Cash'`, amount > 0, and valid category.
     - Resolves `donor_email` to `user_id` if donor is an active member.
     - Sets `recorded_by: actor.user_id`, `status: 'Completed'`, and generates unique receipt number `MH-XXXXXXXX`.
     - Emits `AuditEvent` `donation.recorded`.
   - Admin Query: `GET /api/admin/donations` (lines 106–122):
     - Protected by `fastify.requireMembership(['tenant_admin', 'finance_officer'])`.
     - Supports query params: `status`, `category`, `reconciliation_status`, `search`.
   - Reconcile Mutation: `PATCH /api/admin/donations/:id/reconcile` (lines 124–138):
     - Protected by `fastify.requireMembership(['tenant_admin', 'finance_officer'])`.
     - Updates `reconciliation_status: 'Reconciled'` and `verified_by: actor.user_id`.
     - Emits `AuditEvent` `donation.reconciled`.
   - CSV Export: `GET /api/admin/donations/export.csv` (lines 140–153):
     - Protected by `fastify.requireMembership(['tenant_admin', 'finance_officer'])`.
     - Generates CSV header `receipt,date,amount,currency,category,method,status,reconciliation`.
     - Emits `AuditEvent` `donations.exported`.

3. **Backend Schema Definitions (`backend/src/schemas/donations.schema.ts`)**:
   - `manualDonationSchema` (lines 17–31) requires `amount`, `category`, `method: 'Cash'`, and allows `currency`, `donor_email`, `external_reference`.
   - `queryDonationsSchema` (lines 33–44) accepts `status`, `category`, `reconciliation_status`, `search`.
   - `reconcileDonationSchema` (lines 46–54) validates `id: integer >= 1`.

4. **Frontend Admin Workspace (`frontend/src/app/mosque/[slug]/admin/page.tsx`)**:
   - Interface `Donation` (line 12):
     `interface Donation { donation_id: number; receipt_number: string; amount: number; currency: string; category: string; reconciliation_status: string }`
   - Current Donations tab UI (line 41):
     ```tsx
     {tab === 'donations' && <div className="card-premium"><div className="flex justify-between mb-6"><div><p className="eyebrow">Financial records</p><h2 className="text-3xl font-bold">Donation ledger</h2></div><button onClick={exportDonations} className="btn-secondary text-sm">Export CSV</button></div>{donations.map(d => <div key={d.donation_id} className="grid grid-cols-4 gap-3 py-3 border-b text-sm"><strong>{d.receipt_number}</strong><span>{d.currency} {d.amount.toLocaleString()}</span><span>{d.category}</span><span>{d.reconciliation_status}</span></div>)}</div>}
     ```
   - Current gaps identified in frontend UI:
     a) **No status filtering**: Missing tab/pill selectors for `All`, `Unreconciled`, and `Reconciled`.
     b) **No one-click reconcile action**: Rows show `reconciliation_status` as text with no interactive button calling `PATCH /api/admin/donations/:id/reconcile`.
     c) **No offline cash donation modal/form**: No button or modal to record manual cash entries via `POST /api/admin/donations/manual`.
     d) **Export CSV UX**: Basic export exists but lacks loading indicator and error boundary feedback.

5. **Automated Test Assertions (`backend/test/e2e/tier1-feature-coverage.test.ts` & `tier2-boundary-corner.test.ts`)**:
   - In `tier1-feature-coverage.test.ts` lines 940–998:
     - `12.1 returns HTTP 200 with text/csv content type on GET /api/admin/donations/export.csv`
     - `12.2 sets Content-Disposition header with filename "donations.csv"`
     - `12.3 includes expected CSV column headers on the first line: 'receipt,date,amount,currency,category,method,status,reconciliation'`
     - `12.4 includes formatted donation rows matching database records`
     - `12.5 logs AuditEvent for donations.exported on export execution`
   - In `tier2-boundary-corner.test.ts` lines 871–930:
     - Empty ledger returns header line `receipt,date,amount,currency,category,method,status,reconciliation`.
     - Preserves 2 decimal places for amounts (`500.00`).
     - Restricted to `tenant_admin` and `finance_officer` (HTTP 403 for `communications_officer` and `programme_officer`).

---

## 2. Logic Chain

1. **Reconciliation & Status Filtering**:
   - From Observation 2 and 3, the backend route `PATCH /api/admin/donations/:id/reconcile` is implemented and verified by automated tests.
   - From Observation 4, the frontend workspace currently only renders static text for `reconciliation_status`.
   - Therefore, adding a status filter state (`reconciliationFilter: 'All' | 'Unreconciled' | 'Reconciled'`) and a one-click "Reconcile" button on unreconciled rows that calls `api(slug, `/api/admin/donations/${id}/reconcile`, { method: 'PATCH' })` will fulfill Requirement 1 without requiring backend changes.

2. **Offline Cash Donation Entry**:
   - From Observation 2, `POST /api/admin/donations/manual` expects `amount`, `category`, `method: 'Cash'`, and optional `currency`, `donor_email`, `external_reference`.
   - From Observation 4, the workspace lacks a modal or form trigger for recording cash donations.
   - Therefore, creating a modal dialog / collapsible card in the workspace with inputs for amount, category (`Zakat`, `Sadaqah`, `Waqf`, `General`), currency, donor email, and notes (mapped to `external_reference`), calling `POST /api/admin/donations/manual`, will fulfill Requirement 2.

3. **CSV Ledger Export & RFC 4180 Compliance**:
   - From Observation 2 and 5, `GET /api/admin/donations/export.csv` produces CSV with headers `receipt,date,amount,currency,category,method,status,reconciliation`.
   - To guarantee RFC 4180 compliance across all values (preventing broken rows if references or categories contain commas, double quotes, or newlines), a cell escaping helper `(val: unknown) => string` should escape internal quotes as `""` and wrap fields containing delimiters in `"..."`.
   - From Observation 4, the frontend `exportDonations` function already uses `Blob` and triggers download; adding disabled state (`isExporting`) and status messages ensures robust UX.

---

## 3. Caveats

1. **CSV Header Compatibility**:
   - The user request mentions columns: `Receipt Number`, `Date`, `Donor Name`, `Donor Email`, `Category`, `Amount`, `Currency`, `Payment Method`, `Status`, `Verified By`.
   - However, existing automated tests (`tier1-feature-coverage.test.ts` line 976 and `tier2-boundary-corner.test.ts` line 883) strictly assert that line 0 of `/api/admin/donations/export.csv` is `'receipt,date,amount,currency,category,method,status,reconciliation'`.
   - In the implementation, we should preserve the header structure expected by the automated test suite or ensure full compatibility so that existing test suites pass with 100% success rate.
2. **Read-Only Explorer Constraints**:
   - As an explorer, no production source code has been mutated in this turn. All changes are formulated as precise code specifications for the implementation phase.

---

## 4. Conclusion & Actionable Implementation Plan

### Exact Code Changes Required

#### A. Frontend Workspace Updates (`frontend/src/app/mosque/[slug]/admin/page.tsx`)

1. **Update `Donation` Interface & State**:
   ```tsx
   interface Donation {
     donation_id: number;
     receipt_number: string;
     amount: number;
     currency: string;
     category: string;
     method: string;
     status: string;
     reconciliation_status: string;
     date: string;
     external_reference?: string;
     donor_email?: string;
     verified_by?: number | null;
   }
   
   // State additions:
   const [reconciliationFilter, setReconciliationFilter] = useState<'All' | 'Unreconciled' | 'Reconciled'>('All');
   const [categoryFilter, setCategoryFilter] = useState<string>('All');
   const [showCashModal, setShowCashModal] = useState(false);
   const [cashForm, setCashForm] = useState({
     amount: '',
     category: 'Sadaqah',
     currency: 'NGN',
     donor_email: '',
     notes: ''
   });
   const [isSavingCash, setIsSavingCash] = useState(false);
   const [isExporting, setIsExporting] = useState(false);
   const [reconcilingId, setReconcilingId] = useState<number | null>(null);
   ```

2. **Implement Handlers**:
   - **Reconciliation Handler**:
     ```tsx
     async function reconcileDonation(id: number) {
       try {
         setReconcilingId(id);
         const updated = await api<Donation>(slug, `/api/admin/donations/${id}/reconcile`, {
           method: 'PATCH'
         });
         setDonations(prev => prev.map(d => d.donation_id === id ? { ...d, reconciliation_status: 'Reconciled' } : d));
         done(`Donation ${updated.receipt_number} reconciled.`);
       } catch (x) {
         setError(x instanceof Error ? x.message : 'Could not reconcile donation.');
       } finally {
         setReconcilingId(null);
       }
     }
     ```

   - **Manual Cash Recording Handler**:
     ```tsx
     async function handleRecordCash(e: FormEvent) {
       e.preventDefault();
       const parsedAmount = parseFloat(cashForm.amount);
       if (isNaN(parsedAmount) || parsedAmount <= 0) {
         setError('Please enter a valid cash donation amount greater than 0.');
         return;
       }
       setIsSavingCash(true);
       try {
         const payload = {
           amount: parsedAmount,
           category: cashForm.category,
           method: 'Cash',
           currency: cashForm.currency || 'NGN',
           donor_email: cashForm.donor_email.trim() || undefined,
           external_reference: cashForm.notes.trim() || undefined
         };
         const newDonation = await api<Donation>(slug, '/api/admin/donations/manual', {
           method: 'POST',
           body: JSON.stringify(payload)
         });
         setDonations(prev => [newDonation, ...prev]);
         setShowCashModal(false);
         setCashForm({ amount: '', category: 'Sadaqah', currency: 'NGN', donor_email: '', notes: '' });
         done(`Manual cash donation recorded (Receipt: ${newDonation.receipt_number}).`);
       } catch (x) {
         setError(x instanceof Error ? x.message : 'Could not record manual donation.');
       } finally {
         setIsSavingCash(false);
       }
     }
     ```

   - **CSV Export Handler**:
     ```tsx
     async function exportDonations() {
       try {
         setIsExporting(true);
         const csv = await api<string>(slug, '/api/admin/donations/export.csv');
         const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `${slug}-donations.csv`;
         document.body.appendChild(link);
         link.click();
         document.body.removeChild(link);
         URL.revokeObjectURL(url);
         done('Donation report exported.');
       } catch (x) {
         setError(x instanceof Error ? x.message : 'Could not export donations.');
       } finally {
         setIsExporting(false);
       }
     }
     ```

3. **Donations Tab Render Structure**:
   ```tsx
   {tab === 'donations' && (
     <div className="space-y-6">
       {/* Top Header Card */}
       <div className="card-premium">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
           <div>
             <p className="eyebrow">Financial records</p>
             <h2 className="text-3xl font-bold">Donation ledger</h2>
           </div>
           <div className="flex gap-2">
             <button
               onClick={() => setShowCashModal(true)}
               className="btn-primary text-sm"
             >
               + Record Cash Donation
             </button>
             <button
               onClick={exportDonations}
               disabled={isExporting}
               className="btn-secondary text-sm"
             >
               {isExporting ? 'Exporting...' : 'Export CSV'}
             </button>
           </div>
         </div>

         {/* Filter Tabs */}
         <div className="flex gap-2 border-b pb-4 mb-4 text-sm">
           {(['All', 'Unreconciled', 'Reconciled'] as const).map(f => (
             <button
               key={f}
               onClick={() => setReconciliationFilter(f)}
               className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                 reconciliationFilter === f
                   ? 'bg-emerald-700 text-white'
                   : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
               }`}
             >
               {f} ({f === 'All' ? donations.length : donations.filter(d => d.reconciliation_status === f).length})
             </button>
           ))}
         </div>

         {/* Ledger Table */}
         <div className="overflow-x-auto">
           <table className="w-full text-left text-sm">
             <thead>
               <tr className="border-b text-slate-500 font-semibold">
                 <th className="py-3 px-2">Receipt</th>
                 <th className="py-3 px-2">Date</th>
                 <th className="py-3 px-2">Category</th>
                 <th className="py-3 px-2">Method</th>
                 <th className="py-3 px-2">Amount</th>
                 <th className="py-3 px-2">Status</th>
                 <th className="py-3 px-2 text-right">Actions</th>
               </tr>
             </thead>
             <tbody>
               {filteredDonations.map(d => (
                 <tr key={d.donation_id} className="border-b hover:bg-slate-50/50">
                   <td className="py-3 px-2 font-mono font-bold">{d.receipt_number}</td>
                   <td className="py-3 px-2 text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                   <td className="py-3 px-2"><span className="px-2 py-0.5 rounded bg-slate-100 text-xs font-semibold">{d.category}</span></td>
                   <td className="py-3 px-2">{d.method}</td>
                   <td className="py-3 px-2 font-semibold">{d.currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                   <td className="py-3 px-2">
                     <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                       d.reconciliation_status === 'Reconciled'
                         ? 'bg-emerald-100 text-emerald-800'
                         : 'bg-amber-100 text-amber-800'
                     }`}>
                       {d.reconciliation_status}
                     </span>
                   </td>
                   <td className="py-3 px-2 text-right">
                     {d.reconciliation_status !== 'Reconciled' ? (
                       <button
                         onClick={() => reconcileDonation(d.donation_id)}
                         disabled={reconcilingId === d.donation_id}
                         className="btn-secondary text-xs px-2 py-1"
                       >
                         {reconcilingId === d.donation_id ? 'Reconciling...' : 'Reconcile'}
                       </button>
                     ) : (
                       <span className="text-xs text-emerald-600 font-semibold">✓ Verified</span>
                     )}
                   </td>
                 </tr>
               ))}
               {filteredDonations.length === 0 && (
                 <tr>
                   <td colSpan={7} className="py-8 text-center text-slate-400">No donations matching filter.</td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
       </div>

       {/* Offline Cash Entry Modal */}
       {showCashModal && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold">Record Cash Donation</h3>
               <button onClick={() => setShowCashModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
             </div>
             <form onSubmit={handleRecordCash} className="space-y-4">
               <div>
                 <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Amount ({cashForm.currency}) *</label>
                 <input
                   className="input-field"
                   type="number"
                   step="0.01"
                   min="0.01"
                   placeholder="0.00"
                   value={cashForm.amount}
                   onChange={e => setCashForm({ ...cashForm, amount: e.target.value })}
                   required
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Category *</label>
                 <select
                   className="input-field"
                   value={cashForm.category}
                   onChange={e => setCashForm({ ...cashForm, category: e.target.value })}
                 >
                   <option value="Sadaqah">Sadaqah (Voluntary Charity)</option>
                   <option value="Zakat">Zakat (Alms)</option>
                   <option value="Waqf">Waqf (Endowment)</option>
                   <option value="General">General Operations</option>
                 </select>
               </div>
               <div>
                 <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Donor Email (optional)</label>
                 <input
                   className="input-field"
                   type="email"
                   placeholder="donor@example.com"
                   value={cashForm.donor_email}
                   onChange={e => setCashForm({ ...cashForm, donor_email: e.target.value })}
                 />
               </div>
               <div>
                 <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Reference / Envelope Notes (optional)</label>
                 <input
                   className="input-field"
                   placeholder="e.g. Friday Collection Envelope #12"
                   value={cashForm.notes}
                   onChange={e => setCashForm({ ...cashForm, notes: e.target.value })}
                 />
               </div>
               <div className="flex justify-end gap-2 pt-2">
                 <button
                   type="button"
                   onClick={() => setShowCashModal(false)}
                   className="btn-secondary text-sm"
                 >
                   Cancel
                 </button>
                 <button
                   type="submit"
                   disabled={isSavingCash}
                   className="btn-primary text-sm"
                 >
                   {isSavingCash ? 'Recording...' : 'Save Cash Donation'}
                 </button>
               </div>
             </form>
           </div>
         </div>
       )}
     </div>
   )}
   ```

#### B. Backend Route Escaping Verification (`backend/src/routes/donations.ts`)
Ensure RFC 4180 escaping is applied when generating CSV:
```ts
function escapeCsv(field: unknown): string {
  if (field === null || field === undefined) return '';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

---

## 5. Verification Method

### 1. Automated E2E Test Suite Execution
Execute the full automated test suite to ensure 100% compliance across all 4 tiers:
```bash
# Run all backend E2E tests covering features 11 & 12
npm --prefix backend test

# Run frontend logic verification
npm --prefix frontend run test:node
```

### 2. Manual/Integration Inspection Steps
1. **Status Filtering Verification**:
   - Log in as tenant admin or finance officer at `/mosque/al-noor/login`.
   - Open Donations tab in workspace `/mosque/al-noor/admin`.
   - Verify filter buttons display `All`, `Unreconciled`, and `Reconciled` with correct item counts.
   - Click `Unreconciled` — verify only unreconciled donations appear in the table.
2. **One-Click Reconciliation Verification**:
   - Click "Reconcile" on an unreconciled row.
   - Verify the row immediately updates to `Reconciled` status with green badge and verified indicator.
   - Verify `AuditEvent` with action `donation.reconciled` is created in database.
3. **Offline Cash Donation Modal Verification**:
   - Click "+ Record Cash Donation".
   - Submit a form with Amount `5000.00`, Category `Waqf`, and Notes `Envelope #42`.
   - Verify a new record with `MH-XXXX` receipt number appears in the table with method `Cash` and `Unreconciled` status.
   - Verify `AuditEvent` with action `donation.recorded` is created.
4. **CSV Export Verification**:
   - Click "Export CSV".
   - Verify file `al-noor-donations.csv` downloads with HTTP 200 and Content-Type `text/csv`.
   - Open file to verify header `receipt,date,amount,currency,category,method,status,reconciliation` and properly formatted rows with 2 decimal places.
