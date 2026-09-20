# Change Request (CRQ) Deployment Plan & CAB Approval Summary

**CRQ Reference:** `CRQ-2026-GAPANCHOR-Q3-FINANCE-OPS-V3`  
**Master Change Request ID:** `CRQ-20260920-002`  
**Target Application:** GapAnchor Operations & Revenue Intelligence Hub  
**Environment:** Production (Vercel / Node.js Server + PostgreSQL Neon/Supabase)  
**Release Date:** 20 September 2026  
**Change Type:** Normal / Minor Feature Enhancement & UI Refinement  
**Risk Level:** **LOW** *(Additive PDF generation engine, client-approved matte dark chart aesthetics, and OpsModal form layout optimizations with zero impact on database schemas or core transactions)*  
**Downtime Required:** **NONE (Zero Downtime / Rolling Hot Deployment)**  
**Deployment Window:** Immediate / Scheduled Release  

---

## 1. Executive Summary for Change Advisory Board (CAB)

* **PDF Invoice Generation Engine (`/api/finance/generate-invoice`)**: Implemented a standalone server-side PDF generator using `pdf-lib` to produce official GapAnchor invoices (`GapAnchor_Invoice.pdf`). Features `GapAnchor Consulting` header text, Indian Rupee (`Rs.`) price formatting, itemized course fee breakdown, outstanding balance calculation, and authorized accounts signature without status badge clutter.
* **Income & Expense Breakdown Chart Aesthetics (`components/FinanceCard.tsx`)**: Updated pie chart slices to use sleek, dark matte slate & charcoal SVG gradients (`#334155` → `#1e293b`, `#1e293b` → `#0f172a`), blending harmoniously with the card background. Unified both chart containers to share the exact same `var(--surface-2)` background and border styling.
* **Participant Payment Tracking & Ops Modal (`components/OpsModal.tsx`)**:
  - **Participant Selection Trigger**: Replaced long concatenated name strings with a clean summary label (`6 Participants Selected`).
  - **Even Invoice Buttons**: Standardized row action buttons to `"Invoice"` with uniform `min-w-[76px]` sizing.
  - **Clean Status Column**: Removed colored outline badges in favor of plain, evenly-spaced text (`Pending`, `Partial`, `Paid`).
  - **Header Polish**: Removed unnecessary `"Shrink"` / `"Expand"` text label next to the chevron toggle.
  - **Currency Alignment**: Replaced `$` with `Rs.` in headers and balance calculations.
* **Lead Status Monitoring & Outlook Sync Daemon Crons**: Background monitoring daemon running every 5 minutes (`/api/cron/lead-monitoring`) and 30-minute Outlook ingestion cron (`/api/cron/sync-outlook`).
* **Zero System Regressions**: Fully verified on desktop (2287 × 1100) and mobile viewports; zero database schema breaking changes.
* **Build Verification**: Executed TypeScript compilation check (`npx tsc --noEmit`) with **0 errors**.

---

## 2. Risk & Impact Assessment

| Risk Metric | Level | Justification / Assessment |
|---|---|---|
| **Service Outage Needed?** | **NO** | Zero downtime. Next.js supports hot rolling deployments. |
| **Database Impact** | **NONE** | All schema models remain backward-compatible; no destructive migrations. |
| **Financial Calculations Impact** | **NONE** | Amounts and balances remain 100% accurate; formatting updated to `Rs.`. |
| **Overall Risk Rating** | **LOW** | All changes are client-reviewed UI refinements and isolated API routes. |

---

## 3. Teams & Ownership

| Team Role | Department / Group | Responsibilities |
|---|---|---|
| **Implementation Lead** | GapAnchor Engineering Team | Deployment execution, code verification, build validation |
| **Supporting Team** | GapAnchor Operations Team | Post-deployment smoke testing & participant payment validation |
| **Finance Sign-off** | GapAnchor Accounts Team | PDF Invoice formatting & rupee currency verification |
| **Approving Body** | Change Advisory Board (CAB) | Formal CRQ authorization & production approval |

---

## 4. Change Sequence Steps (Deployment Checklist)

| Step ID | Component / Area | Description | Target Files |
|---|---|---|---|
| `STEP-CHG-201` | PDF Invoice Generator | PDF-lib engine with clean text header, Rs. currency, & signature | `app/api/finance/generate-invoice/route.ts` |
| `STEP-CHG-202` | Finance Chart Aesthetics | Dark matte pie chart gradients & unified `var(--surface-2)` background | `components/FinanceCard.tsx` |
| `STEP-CHG-203` | Training Ops Modal | Clean selection trigger, even `Invoice` buttons, plain status text | `components/OpsModal.tsx` |
| `STEP-CHG-204` | Lead Monitoring Cron | 4-hour inactivity escalation daemon | `lib/lead-monitoring.ts`, `app/api/cron/lead-monitoring/route.ts` |
| `STEP-CHG-205` | Outlook Sync Cron | 30-minute automated email ingestion service | `app/api/cron/sync-outlook/route.ts` |
| `STEP-CHG-206` | Production Cron Config | Vercel platform cron configuration | `vercel.json` |

---

## 5. Unique Primary Key (PK) Granular Rollback Matrix

If any individual feature encounters an unexpected issue in production, it can be reverted independently using its **Unique PK Value** without rolling back the entire release:

```
+----------------------------------------------------------------------------------------------------+
|                                    GRANULAR PK ROLLBACK MATRIX                                     |
+--------------------------+------------------------------+------------------------------------------+
| Unique PK Value          | Affected Component           | Granular Rollback Command                |
+--------------------------+------------------------------+------------------------------------------+
| PK-CHG-20260920-INV01    | PDF Invoice Generator API    | git checkout HEAD~1 -- app/api/finance/  |
|                          |                              | generate-invoice/route.ts                |
| PK-CHG-20260920-FIN02    | Finance Pie Chart Aesthetics | git checkout HEAD~1 -- components/       |
|                          | & Card Background            | FinanceCard.tsx                          |
| PK-CHG-20260920-OPS03    | Training Ops Payment Table   | git checkout HEAD~1 -- components/       |
|                          | & Participant Dropdown       | OpsModal.tsx                             |
| PK-CHG-20260920-LEAD04   | Lead Status Monitoring Cron  | rm -rf app/api/cron/lead-monitoring      |
| PK-CHG-20260920-SYNC05   | Outlook Email Sync Cron      | rm -rf app/api/cron/sync-outlook         |
| PK-CHG-20260920-VERC06   | Vercel Cron Configuration    | git checkout HEAD~1 -- vercel.json       |
+--------------------------+------------------------------+------------------------------------------+
```

### Detailed PK Profiles & Specific Rollback Procedures

#### `PK-CHG-20260920-INV01`
- **Component**: PDF Invoice Generation API (`/api/finance/generate-invoice`)
- **Scope**: PDF generation, clean header text, Rs. currency formatting.
- **Rollback Procedure**:
  ```bash
  git checkout HEAD~1 -- app/api/finance/generate-invoice/route.ts
  ```
- **Impact**: Reverts invoice generator to previous template version.

#### `PK-CHG-20260920-FIN02`
- **Component**: Finance Breakdown Card (`components/FinanceCard.tsx`)
- **Scope**: Dark matte pie chart colors & unified `var(--surface-2)` card background.
- **Rollback Procedure**:
  ```bash
  git checkout HEAD~1 -- components/FinanceCard.tsx
  ```
- **Impact**: Restores previous gradient background and shiny silver pie chart slices.

#### `PK-CHG-20260920-OPS03`
- **Component**: Training Operations Modal (`components/OpsModal.tsx`)
- **Scope**: Summary selection trigger, even `Invoice` buttons, plain status text, Rupee labels.
- **Rollback Procedure**:
  ```bash
  git checkout HEAD~1 -- components/OpsModal.tsx
  ```
- **Impact**: Reverts modal form fields to previous layout.

---

## 6. Pre-Deployment Verification & Build Validation

1. **Type Safety Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Result: 0 errors.*

2. **Invoice Generation Smoke Test**:
   ```bash
   node -e "fetch('http://localhost:3000/api/finance/generate-invoice', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ participantName: 'Udhayanila', topic: 'Manhattan Active WMS Batch - 34 [Meghana]', amountDue: 44630, amountPaid: 0 }) }).then(res => console.log('Status:', res.status))"
   ```
   *Result: HTTP 200 OK.*

---

## 7. Production Push Sequence

1. Commit changes and push to `main` branch.
2. Trigger Vercel rolling production deployment (Zero Downtime).
3. Post-deployment verification on live URL.
