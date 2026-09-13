# Change Request (CRQ) Deployment Plan & Release Notes

**CRQ Reference:** `CRQ-2026-GAPANCHOR-Q3-OPS-UPGRADE-V2`  
**Master Change Request ID:** `CRQ-20260913-001`  
**Target Application:** GapAnchor Ops Dashboard  
**Environment:** Production (Vercel / Node.js Server + PostgreSQL Neon/Supabase)  
**Release Date:** 13 September 2026  
**Change Type:** Normal / Minor Enhancement  
**Risk Level:** **LOW** *(Additive database schema models, new isolated cron jobs, and mobile-scoped CSS/layout optimizations with zero impact on desktop viewports)*  
**Downtime Required:** **None (Zero Downtime / Rolling Deployment)**  
**Deployment Window:** Immediate / Scheduled Release  

---

## 1. CAB Executive Summary (Description for Change Approval)

*Copy and paste the following bullet points into the Change Request (CRQ) description field for CAB review:*

* **Lead Status Monitoring & Escalating Alert Cron**: Implemented an automated background monitoring daemon running every 5 minutes (`/api/cron/lead-monitoring`) that detects leads in "Pending" status exceeding a 4-hour grace period, dispatching escalating alert emails every 30 minutes with direct resolution links and audit logging in `LeadMonitoringAudit`.
* **Automated Outlook Enquiry Ingestion Cron**: Deployed a recurring 30-minute sync service (`/api/cron/sync-outlook`) to extract inbound lead enquiries and financial records from Outlook into PostgreSQL, eliminating manual sync dependencies.
* **Calendar Hub Selected Day Schedule & Touch Targets (`/calendar`)**: Upgraded month-view day cells to an accessible touch height (`min-h-[64px]`), and implemented a dynamic **Selected Day Schedule** panel directly underneath the month calendar grid displaying event times, titles, platform tags (`Google Meet`, `Teams`, `Zoom`), participant counts, and active "Join" and "Details" buttons.
* **Finance Intelligence Compact Mobile Cards (`/finance/analytics`)**: Replaced wide horizontal tables on mobile viewports (`< md`) with compact, zero-swipe cards featuring formatted amounts in the header (`+₹27,815` / `-₹200`), expandable details, reference IDs (`#S26245676`), and live inline dropdown selectors for Category and Payment Method recategorization.
* **Training and Finance Tracking Module (`/` & `OpsModal`)**: Extended session tracking to include individual participant payments (`amountDue`, `amountPaid`, `paymentStatus`) and trainer financials (`trainerTotalCost`, `trainerAmountPaid`, `trainerAmountDue`); verified mobile touch accessibility and responsiveness for the `+ Add Session` button and modal across portrait and landscape modes.
* **Leads Command Center Mobile Overlap Fix (`CommsCard.tsx`)**: Resolved badge and action button overlapping on mobile via a dedicated 3-row card layout (Contact Header, Topic/Timestamp, and Action/Assignment row) while preserving 100% of the desktop table structure.
* **Landing Page Executive Layout & UI Polish**: Streamlined top KPI cards into a compact 2x2 grid on mobile screens, reduced vertical header padding, eliminated all emojis in favor of Lucide React icons, and applied glassmorphic dark theme aesthetics.
* **Vercel Cron Scheduling Configuration (`vercel.json`)**: Configured production cron triggers for automated lead monitoring (`*/5 * * * *`) and Outlook sync (`*/30 * * * *`).
* **Zero Desktop Regressions**: Verified full-screen desktop resolution (2287 × 1100); all desktop multi-column tables, 4-column KPI cards, charts, and header strings remain 100% unaltered.
* **Build Verification**: Executed TypeScript compilation check (`tsc --noEmit`) with **0 errors**.

---

## 2. Change Sequence Steps (Step Sequence Starting Now)

| Step Sequence ID | Component / Area | Description | Target Files |
|---|---|---|---|
| `STEP-CHG-101` | Database Schema | Add `SessionParticipant`, `LeadMonitoringAudit`, `CronExecutionLog`, and trainer cost fields | `prisma/schema.prisma` |
| `STEP-CHG-102` | Lead Monitoring Daemon | 4-hour inactivity trigger + 30-min escalating email alert daemon | `lib/lead-monitoring.ts`, `lib/email-service.ts`, `app/api/cron/lead-monitoring/route.ts` |
| `STEP-CHG-103` | Outlook Email Sync Cron | Automated 30-minute email sync daemon | `app/api/cron/sync-outlook/route.ts`, `scripts/extract_outlook_enquiries.py` |
| `STEP-CHG-104` | Calendar Hub Mobile UI | Month grid touch cell sizing & Selected Day Schedule below grid | `app/calendar/page.tsx`, `components/CalendarWidget.tsx` |
| `STEP-CHG-105` | Finance Analytics Mobile UI | Zero-horizontal-scroll transaction cards & inline dropdown editing | `app/finance/analytics/page.tsx`, `components/FinanceCard.tsx`, `app/api/finance/*` |
| `STEP-CHG-106` | Training Ops & Payments | Session participant payments & "+ Add Session" mobile modal | `components/OpsCard.tsx`, `components/OpsModal.tsx`, `app/api/ops/route.ts` |
| `STEP-CHG-107` | Leads Command Center | 3-Row mobile card structure preventing badge/button overlaps | `components/CommsCard.tsx`, `components/MobileLeadCards.tsx` |
| `STEP-CHG-108` | Landing Page & CSS Polish | 2x2 mobile KPI grid, compact header, emoji elimination | `app/page.tsx`, `app/globals.css`, `components/StatCard.tsx`, `components/DashboardHeader.tsx` |
| `STEP-CHG-109` | Cron Orchestration | Vercel production cron definitions | `vercel.json` |

---

## 3. Unique Primary Key (PK) Rollback Matrix

If any individual feature encounters an unexpected defect in production, it can be reverted independently using the designated **Unique PK Value** and its granular rollback procedure without rolling back the entire release.

```
+----------------------------------------------------------------------------------------------------+
|                                    GRANULAR PK ROLLBACK MATRIX                                     |
+--------------------------+------------------------------+------------------------------------------+
| Unique PK Value          | Affected Component           | Granular Rollback Command                |
+--------------------------+------------------------------+------------------------------------------+
| PK-CHG-20260913-DB01     | Prisma Schema & Database     | git checkout HEAD~1 -- prisma/schema.prisma|
| PK-CHG-20260913-LEAD02   | Lead Status Monitoring Cron  | rm -rf lib/lead-monitoring.ts app/api/   |
|                          |                              | cron/lead-monitoring                     |
| PK-CHG-20260913-SYNC03   | Outlook Sync Cron            | rm -rf app/api/cron/sync-outlook         |
| PK-CHG-20260913-CAL04    | Calendar Hub Selected Day    | git checkout HEAD~1 -- app/calendar/     |
|                          | Schedule & Grid              | page.tsx components/CalendarWidget.tsx   |
| PK-CHG-20260913-FIN05    | Finance Mobile Cards &       | git checkout HEAD~1 -- app/finance/      |
|                          | Inline Dropdowns             | analytics/page.tsx components/FinanceCard|
| PK-CHG-20260913-OPS06    | Training Operations Add      | git checkout HEAD~1 -- components/       |
|                          | Session & OpsModal           | OpsCard.tsx components/OpsModal.tsx      |
| PK-CHG-20260913-COMMS07  | Leads Mobile 3-Row Overlap   | git checkout HEAD~1 -- components/       |
|                          | Layout                       | CommsCard.tsx components/MobileLeadCards |
| PK-CHG-20260913-UI08     | Landing Page 2x2 KPIs & CSS  | git checkout HEAD~1 -- app/page.tsx      |
|                          | Polish                       | app/globals.css components/StatCard.tsx  |
| PK-CHG-20260913-VERC09   | Vercel Cron Config           | git checkout HEAD~1 -- vercel.json       |
+--------------------------+------------------------------+------------------------------------------+
```

### Detailed PK Profiles & Specific Rollback Procedures

#### `PK-CHG-20260913-DB01`
- **Component**: PostgreSQL Database Schema / Prisma ORM
- **Scope**: Added `SessionParticipant`, `LeadMonitoringAudit`, `CronExecutionLog` models and trainer cost fields (`trainerTotalCost`, `trainerAmountPaid`, `trainerAmountDue`) to `Session`.
- **Files**: `prisma/schema.prisma`
- **Rollback Procedure**:
  ```bash
  git checkout 7374db4 -- prisma/schema.prisma
  npx prisma generate
  ```
- **Rollback Impact**: Non-breaking if participant payment data is not actively referenced; existing tables remain untouched.

#### `PK-CHG-20260913-LEAD02`
- **Component**: Lead Status Monitoring & Escalation Service
- **Scope**: Monitors leads with `contactStatus = "Pending"` for 4 hours; triggers escalation emails every 30 minutes.
- **Files**: `lib/lead-monitoring.ts`, `lib/email-service.ts`, `app/api/cron/lead-monitoring/route.ts`
- **Rollback Procedure**:
  ```bash
  rm -f lib/lead-monitoring.ts lib/email-service.ts
  rm -rf app/api/cron/lead-monitoring
  ```
- **Rollback Impact**: Disables automated email escalations; manual lead processing on `/enquiries` remains functional.

#### `PK-CHG-20260913-SYNC03`
- **Component**: Automated Outlook Email Ingestion Cron
- **Scope**: Automatically pulls Outlook enquiries and transactions every 30 minutes.
- **Files**: `app/api/cron/sync-outlook/route.ts`, `scripts/extract_outlook_enquiries.py`
- **Rollback Procedure**:
  ```bash
  rm -rf app/api/cron/sync-outlook
  ```
- **Rollback Impact**: Disables 30-minute background sync; manual "Sync Outlook" button on `/enquiries` remains available.

#### `PK-CHG-20260913-CAL04`
- **Component**: Calendar Hub Mobile Schedule & Grid
- **Scope**: Increases day cell touch height to `min-h-[64px]` and displays Selected Day Schedule below the month grid.
- **Files**: `app/calendar/page.tsx`, `components/CalendarWidget.tsx`
- **Rollback Procedure**:
  ```bash
  git checkout 7374db4 -- app/calendar/page.tsx components/CalendarWidget.tsx
  ```
- **Rollback Impact**: Reverts to default month grid; event details drawer remains accessible on desktop.

#### `PK-CHG-20260913-FIN05`
- **Component**: Finance Intelligence Mobile Cards & Selectors
- **Scope**: Compact mobile cards (`< md`), zero horizontal scrolling, amount in header, inline Category & Payment Method selectors.
- **Files**: `app/finance/analytics/page.tsx`, `components/FinanceCard.tsx`, `app/api/finance/*`
- **Rollback Procedure**:
  ```bash
  git checkout 7374db4 -- app/finance/analytics/page.tsx components/FinanceCard.tsx
  ```
- **Rollback Impact**: Reverts mobile view back to horizontal-scrolling table.

#### `PK-CHG-20260913-OPS06`
- **Component**: Training Operations & Participant Payments
- **Scope**: Re-engineered `OpsModal.tsx` for participant fee tracking and verified `+ Add Session` button for mobile touch targets.
- **Files**: `components/OpsCard.tsx`, `components/OpsModal.tsx`, `app/api/ops/route.ts`
- **Rollback Procedure**:
  ```bash
  git checkout 7374db4 -- components/OpsCard.tsx components/OpsModal.tsx app/api/ops/route.ts
  ```
- **Rollback Impact**: Reverts to standard session modal without nested participant payments.

#### `PK-CHG-20260913-COMMS07`
- **Component**: Leads Command Center Mobile Layout
- **Scope**: 3-row layout in `CommsCard.tsx` preventing badge/action overlaps on mobile screens.
- **Files**: `components/CommsCard.tsx`, `components/MobileLeadCards.tsx`
- **Rollback Procedure**:
  ```bash
  git checkout 7374db4 -- components/CommsCard.tsx components/MobileLeadCards.tsx
  ```
- **Rollback Impact**: Reverts to previous 2-row layout.

#### `PK-CHG-20260913-UI08`
- **Component**: Landing Page Layout & CSS Polish
- **Scope**: 2x2 mobile KPI grid, compact header padding, emoji replacement with Lucide icons, glassmorphism utilities.
- **Files**: `app/page.tsx`, `app/globals.css`, `components/StatCard.tsx`, `components/DashboardHeader.tsx`
- **Rollback Procedure**:
  ```bash
  git checkout 7374db4 -- app/page.tsx app/globals.css components/StatCard.tsx components/DashboardHeader.tsx
  ```
- **Rollback Impact**: Reverts to 1-column mobile KPI cards and restores previous global styles.

#### `PK-CHG-20260913-VERC09`
- **Component**: Cron Ingestion Configuration
- **Scope**: Vercel cron configuration for 5-minute lead monitoring and 30-minute Outlook sync.
- **Files**: `vercel.json`
- **Rollback Procedure**:
  ```bash
  rm -f vercel.json
  ```
- **Rollback Impact**: Stops Vercel platform-level automated cron invocations.

---

## 4. Pre-Deployment Prerequisites

1. **Environment Requirements**:
   - Node.js >= 18.x
   - NPM >= 9.x
   - PostgreSQL Database (Neon / Supabase)
2. **Environment Variables**:
   - `DATABASE_URL`: Production PostgreSQL connection string.
   - `NEXT_PUBLIC_APP_URL`: Production domain URL (e.g., `https://ops.gapanchor.com`).
   - `ETHEREAL_USER` / `ETHEREAL_PASS`: *(Optional)* Fallback email credentials.
   - `ADMIN_ALERT_EMAIL`: Alert escalation recipient (default: `support@gapanchor.com`).
   - `GOOGLE_CALENDAR_ICAL_URL`: Secret iCal feed URL for Google Calendar.

---

## 5. Step-by-Step Deployment Instructions

1. **Fetch Latest Code**:
   ```bash
   git pull origin main
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Generate Prisma Client & Sync Database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
4. **Run TypeScript Verification**:
   ```bash
   npx tsc --noEmit
   ```
5. **Build Production Application**:
   ```bash
   npm run build
   ```
6. **Start Application Server**:
   ```bash
   npm run start
   ```
   *(Or trigger Vercel automated git push deployment).*
7. **Verify Cron Endpoints**:
   ```bash
   curl -s http://localhost:3000/api/cron/lead-monitoring
   curl -s http://localhost:3000/api/cron/sync-outlook
   ```

---

## 6. Post-Deployment Verification Checklist

- [ ] **Lead Status Monitoring Cron**:
  - Call `/api/cron/lead-monitoring` and confirm `200 OK` response with JSON stats (`leadsChecked`, `firstAlertsSent`, `recurringAlertsSent`).
- [ ] **Outlook Email Sync Cron**:
  - Call `/api/cron/sync-outlook` and verify `200 OK` sync response.
- [ ] **Calendar Hub (`/calendar`)**:
  - Open `/calendar` on mobile simulator (iPhone 15, 393 × 852).
  - Tap on date cells with events (e.g., Day 8).
  - Confirm **Selected Day Schedule** populates directly beneath the calendar grid with meeting times, platform badges, and active "Join" / "Details" buttons.
- [ ] **Finance Intelligence (`/finance/analytics`)**:
  - Open `/finance/analytics` on mobile simulator.
  - Verify zero horizontal swiping; cards fit 100% within viewport.
  - Tap on a transaction card; verify inline **Category** and **Payment Method** dropdowns function properly.
- [ ] **Training Operations (`/`)**:
  - Navigate to `/` on mobile simulator and scroll to Training Operations card.
  - Click **`+ Add Session`** button.
  - Confirm `OpsModal` opens cleanly with all fields accessible.
- [ ] **Desktop Regression Verification**:
  - Open `http://<domain>/` on full desktop viewport (>= 1280px).
  - Confirm multi-column tables, 4-column KPI cards, charts, and header strings remain unaltered.
