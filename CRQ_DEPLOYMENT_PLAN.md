# Change Request (CRQ) Deployment Plan & CAB Approval Summary

**CRQ Reference:** `CRQ-2026-GAPANCHOR-OCT-MOBILE-RESPONSIVE-V5`  
**Master Change Request ID:** `CRQ-20261003-005`  
**CAB Change ID:** `CAB-20261003-005`  
**Target Application:** GapAnchor Operations & Revenue Intelligence Hub  
**Environment:** Production (Vercel / Node.js Server + PostgreSQL Supabase / Prisma)  
**Scheduled Deployment Window:** **Saturday, 3 October 2026 – Sunday, 4 October 2026** (02:00 UTC Maintenance Window)  
**Change Type:** Normal / UI & Mobile Responsiveness Enhancement, Dropdown Cards & API Persistence Fix  
**Risk Level:** **LOW** *(Additive mobile dropdown card views, text size scaling, responsive header alignment, and API persistence with zero regression on core protected components)*  
**Downtime Required:** **NONE (Zero Downtime / Rolling Hot Deployment)**  

---

## 1. Executive Summary for Change Advisory Board (CAB)

Today's change sequence (**3 October 2026 — CRQ-20261003-005**) delivers complete **Mobile-Responsive UI Optimization & Expandable Dropdown Cards** across the GapAnchor Operations & Revenue Intelligence Hub:

* **Expandable Mobile Dropdown Cards (`app/trainers/page.tsx`, `components/TrainersCard.tsx`)**:
  - Replaced multi-column table side-swiping on mobile screens with collapsible `MobileTrainerCardFull` and `MobileTrainerCard` components using `ChevronDown` / `ChevronUp` buttons.
  - Preserved full 7-column desktop tables intact using `hidden md:block` and mobile cards using `block md:hidden`.
* **Mobile Layout Sizing & Header Alignment (`app/trainers/page.tsx`, `app/job-support/page.tsx`)**:
  - Redesigned top header navigation bars to cleanly fit title, subtitle, `+ Add Staff`, `Sync Outlook`, and `UserNav` on mobile without text wrapping or awkward button stacking.
  - Refined `getRoleBadge` in `app/trainers/page.tsx` and `TrainerModal.tsx` from fixed `w-36` to dynamic responsive pill sizing on mobile view.
* **Candidate Drawer Detail Sizing & Profile Synthesis (`components/TrainerModal.tsx`)**:
  - Compacted candidate profile drawer header, 4-metric grid (*Primary Module*, *Batches Taken*, *Job Support*, *Experience*), and experience notes card on mobile screens.
  - Enhanced candidate profile synthesis logic to filter out generic placeholder notes and present verified candidate details.
* **Job Support KPI Grid Sizing (`app/job-support/page.tsx`)**:
  - Adjusted top KPI card text labels and metric sizing so labels like "Engineer Compensation Payable" fit cleanly on 2-column mobile screens without multi-line wrapping.
* **Finance Header & Pie Chart Alignment (`components/FinanceCard.tsx`)**:
  - Compacted header buttons (*Analytics*/*Transactions*, *CSV*, *Add Entry*, *Deck*) into a responsive flex layout.
  - Tuned donut chart inner/outer radius for clean mobile rendering with zero edge collision.
* **API Candidate Update Persistence (`app/api/trainers/route.ts`)**:
  - Added explicit number type coercion in `PUT` handler to persist candidate `experienceYears`, `name`, `email`, and `phone` updates to PostgreSQL database.
* **Zero Core System Regressions**:
  - Strictly preserved all 5 protected core files ([`lib/outlook-graph-sync.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/lib/outlook-graph-sync.ts), [`app/enquiries/page.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/app/enquiries/page.tsx), [`components/DashboardHeader.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/DashboardHeader.tsx), [`components/NavigationDrawer.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/NavigationDrawer.tsx), [`app/api/enquiries/sync-excel/route.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/app/api/enquiries/sync-excel/route.ts)).
* **Build & Verification**:
  - Executed Next.js production build (`npm run build`) with **0 errors** across all 38 application routes.

---

## 2. Risk & Impact Assessment

| Risk Metric | Level | Justification / Assessment |
|---|---|---|
| **Service Outage Needed?** | **NO** | Zero downtime. Vercel / Next.js rolling hot deployment. |
| **Database Impact** | **NONE** | No schema migration required; standard `PUT` field update persistence. |
| **Protected Components Impact** | **NONE** | All 5 protected core system architecture files remain 100% untouched. |
| **Overall Risk Rating** | **LOW** | Scoped CSS breakpoints (`md:hidden` / `hidden md:block`), non-breaking API updates. |

---

## 3. Teams & Ownership

| Team Role | Department / Group | Responsibilities |
|---|---|---|
| **Implementation Lead** | GapAnchor Engineering Team | Code development, mobile UI optimization, build validation |
| **Operations Sign-off** | GapAnchor Operations Team | Post-deployment candidate intake & mobile layout verification |
| **Release Lead** | GapAnchor Release Management | Production git push execution during Saturday/Sunday window |
| **Approving Body** | Change Advisory Board (CAB) | Production authorization & CRQ approval |

---

## 4. Change Sequence Steps (Deployment Checklist)

| Step ID | Component / Area | Description | Target Files |
|---|---|---|---|
| `STEP-CHG-501` | Mobile Candidate Cards | Replace side-swiping table with expandable `ChevronDown` dropdown cards | `app/trainers/page.tsx`, `components/TrainersCard.tsx` |
| `STEP-CHG-502` | Dynamic Role Badges | Replace fixed `w-36` badges with responsive mobile pill sizing | `app/trainers/page.tsx`, `components/TrainerModal.tsx` |
| `STEP-CHG-503` | Header Bar Alignment | Responsive flex layout for top action buttons & header text | `app/trainers/page.tsx`, `app/job-support/page.tsx` |
| `STEP-CHG-504` | Candidate Modal Sizing | Compact header avatar, 4-metric grid, and profile note synthesis | `components/TrainerModal.tsx` |
| `STEP-CHG-505` | Job Support KPI Grid | Compact metric text sizing for 2-column mobile KPI layout | `app/job-support/page.tsx` |
| `STEP-CHG-506` | API Candidate Persistence | Persist `experienceYears`, `name`, `email`, `phone` in candidate `PUT` route | `app/api/trainers/route.ts` |

---

## 5. Unique Primary Key (PK) Granular Rollback Matrix

```
+----------------------------------------------------------------------------------------------------+
|                                    GRANULAR PK ROLLBACK MATRIX                                     |
+--------------------------+------------------------------+------------------------------------------+
| Unique PK Value          | Affected Component           | Granular Rollback Command                |
+--------------------------+------------------------------+------------------------------------------+
| PK-CHG-20261003-MOB01    | Mobile Trainer Cards         | git checkout HEAD~1 -- app/trainers/     |
|                          |                              | page.tsx components/TrainersCard.tsx     |
| PK-CHG-20261003-BDG02    | Responsive Role Badges       | git checkout HEAD~1 -- components/       |
|                          |                              | TrainerModal.tsx                         |
| PK-CHG-20261003-HDR03    | Header Action Bar Alignment  | git checkout HEAD~1 -- app/job-support/  |
|                          |                              | page.tsx                                 |
| PK-CHG-20261003-MOD04    | Candidate Modal Sizing       | git checkout HEAD~1 -- components/       |
|                          |                              | TrainerModal.tsx                         |
| PK-CHG-20261003-KPI05    | Job Support KPI Layout       | git checkout HEAD~1 -- app/job-support/  |
|                          |                              | page.tsx                                 |
| PK-CHG-20261003-API06    | Trainer API Persistence PUT  | git checkout HEAD~1 -- app/api/trainers/ |
|                          |                              | route.ts                                 |
+--------------------------+------------------------------+------------------------------------------+
```

---

## 6. Verification & Sign-off

- **Build Check**: `npm run build` (**0 errors**, 38/38 static pages generated)
- **Dedicated Routes Verified**: `/trainers`, `/job-support`, `/`
- **Protected Core Status**: **100% UNTOUCHED**
