# CAB Change Approval & Production Push Summary

**CRQ Reference:** `CRQ-2026-GAPANCHOR-OCT-MOBILE-RESPONSIVE-V5`  
**Master Change Request ID:** `CRQ-20261003-005`  
**CAB Change ID:** `CAB-20261003-005`  
**Application:** GapAnchor Operations & Revenue Intelligence Hub  
**Target Production Push Window:** **Saturday, 3 October 2026 – Sunday, 4 October 2026**  
**Downtime Required:** **NONE (Zero Downtime / Rolling Hot Deployment)**  
**Risk Level:** **LOW**  

---

## Executive Summary of Today's Changes (3 October 2026)

1. **Mobile Candidate Dropdown Cards (`app/trainers/page.tsx`, `components/TrainersCard.tsx`)**:
   - Replaced multi-column table side-swiping on mobile views with expandable `MobileTrainerCardFull` and `MobileTrainerCard` components featuring `ChevronDown` / `ChevronUp` details toggles.
2. **Dynamic Responsive Role Badges (`app/trainers/page.tsx`, `components/TrainerModal.tsx`)**:
   - Replaced fixed `w-36` badge widths with responsive mobile pill sizing so candidate names and badges wrap cleanly.
3. **Command Center Header Bar Layout (`app/trainers/page.tsx`, `app/job-support/page.tsx`)**:
   - Redesigned top action buttons (`+ Add Staff`, `+ New Support`, `Sync`, `UserNav`) into clean responsive flex containers for zero text wrapping or button overlap on mobile.
4. **Candidate Drawer Detail Sizing & Notes Synthesis (`components/TrainerModal.tsx`)**:
   - Compacted candidate avatar, 4-metric grid (*Primary Module*, *Batches Taken*, *Job Support*, *Experience*), and experience notes card on mobile.
   - Filtered out generic placeholder notes to present clean synthesized profile details.
5. **Job Support KPI Cards Sizing (`app/job-support/page.tsx`)**:
   - Compacted metric labels and amounts so 2-column KPI cards render cleanly on mobile view without multi-line wrapping.
6. **Finance Header & Pie Chart Alignment (`components/FinanceCard.tsx`)**:
   - Compacted header buttons (*Analytics*/*Transactions*, *CSV*, *Add Entry*, *Deck*) and optimized donut chart radii for mobile view.
7. **API Candidate Persistence (`app/api/trainers/route.ts`)**:
   - Added explicit number parsing in `PUT` handler to persist candidate `experienceYears`, `name`, `email`, and `phone` updates to PostgreSQL database.

---

## Risk, Outage & Team Ownership Assessment

- **Outage Required:** **NO (Zero Downtime)**
- **Risk Level:** **LOW**
- **Protected Core Files:** 100% untouched (zero regression on Graph Cloud Sync, Enquiry Intelligence, Dashboard Header, Navigation Drawer, or Excel Intake).
- **Teams Involved:**
  - Implementation Lead: GapAnchor Engineering Team
  - Supporting Team: GapAnchor Operations Team
  - Approving Body: Change Advisory Board (CAB)

---

## Production Push Window & Instructions

- **Target Deployment Window**: **Saturday, 3 October 2026 – Sunday, 4 October 2026**
- **Deployment Procedure**:
  ```bash
  git add .
  git commit -m "feat(mobile): Mobile responsive dropdown cards, header alignment, font scaling & API persistence (CRQ-20261003-005)"
  git push origin main
  ```
- **Verification Commands**:
  - Type & Build check: `npm run build` (**0 errors**, 38/38 routes compiled)
  - Dedicated Routes: `http://localhost:3000/trainers`, `http://localhost:3000/job-support`
