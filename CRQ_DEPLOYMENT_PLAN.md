# Change Request (CRQ) Deployment Plan & Release Notes

**CRQ Reference:** `CRQ-2026-GAPANCHOR-CALENDAR-LEADS`  
**Target Application:** GapAnchor Ops Dashboard  
**Release Schedule:** End of Week Deployment  
**Environment:** Production (Vercel / Node.js Server)  
**Risk Level:** **LOW** *(New isolated features; zero modifications or breaking changes to existing Finance, Operations, Comms, or Prisma database schemas)*  

---

## 1. Summary of Changes

### A. Google Calendar Live Integration Module
* **Real-Time Calendar Feed Engine (`lib/googleCalendar.ts`)**:
  * Implemented live `.ics` secret feed parser powered by `node-ical`.
  * Added meeting platform link extractor supporting **Google Meet**, **Microsoft Teams**, **Zoom**, and **In-Person** venues.
  * Configured AES-256-GCM token & config encryption for security.
  * Completely eliminated mock/demo fallback data — returns live events or clean empty states.
* **Landing Page Compact Widget (`components/CalendarWidget.tsx`)**:
  * Rendered full-width at the bottom of the landing page (`/`).
  * Displays 4 upcoming events with duration badges, meeting type tags, and direct **[JOIN]** buttons.
  * Includes 5-minute auto-refresh interval and manual refresh controls.
* **Full Interactive Calendar Page (`app/calendar/page.tsx`)**:
  * Dedicated calendar hub accessible at `/calendar`.
  * Supports Month, Week, and Agenda/List views with mini-calendar navigator.
  * Platform filtering (Google Meet, Teams, Zoom, In-Person).
  * Right-side preview drawer displaying event objectives and attendee lists.
* **API Endpoints (`app/api/calendar/*`)**:
  * `/api/calendar/status`: Connection state and user email verification.
  * `/api/calendar/events`: Live event feed supplier.
  * `/api/calendar/connect-feed`: Secure Secret iCal URL validator and database persistence endpoint.
  * `/api/calendar/disconnect`: Calendar connection reset endpoint.

---

### B. Mobile Leads Command Center Optimization (`/enquiries`)
* **Isolated Mobile Component (`components/MobileLeadCards.tsx`)**:
  * Enforces mobile-only rendering (`< 768px` / `md:hidden`).
  * 100% isolation: Zero side-effects or style leaks to desktop table view (`>= 768px`).
* **Sleek 2-Line Header Architecture**:
  * **Line 1 (Primary)**: Participant Avatar + Full Name (Left) | Contact Status Badge (`Pending`) + Chevron (Right).
  * **Line 2 (Metadata)**: Country Badge (`🌐 India`) • Full Course Name (`Manhattan WMS` / `SAP S/4HANA`).
  * Eliminates text truncation (`Manhatta...`) and ugly line wraps.
* **Header Height & Contact Dropdown**:
  * Header collapsed height reduced to ~46px.
  * Phone (`📱`) and Email (`✉️`) moved into expandable dropdown with direct clickable WhatsApp/Call/Mail actions.
* **Desktop Color Scheme Alignment**:
  * Cards use exact desktop dark palette (`bg-slate-900/80`, `border-slate-800/80`, desktop status & quality badge colors).
* **Full Screen Space Utilization & Overflow Fix**:
  * Container padding relaxed to span full mobile width without nested box-in-box borders.
  * Enforced `overflow-x: hidden` to prevent mobile horizontal page scrolling.

---

### C. Leads Pagination & Performance Enhancements
* Adjusted default enquiry page size to 10 compact records with clear Previous / Page X of Y / Next pagination buttons.

---

## 2. Pre-Deployment Prerequisites

1. **Environment Requirements**:
   * Node.js >= 18.x
   * NPM >= 9.x
2. **Dependencies (auto-installed via package.json)**:
   * `node-ical`
   * `date-fns`
   * `googleapis`
3. **Environment Variables (Optional)**:
   * `GOOGLE_CALENDAR_ICAL_URL`: *(Optional)* Pre-configures production Secret iCal address.
   * `GOOGLE_CALENDAR_EMAIL`: *(Optional)* Pre-configures target user email (default: `xavierarul40@gmail.com`).

---

## 3. Step-by-Step Deployment Instructions

1. **Fetch Latest Code**:
   ```bash
   git pull origin main
   ```
2. **Install Package Dependencies**:
   ```bash
   npm install
   ```
3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```
4. **Build Production Bundle**:
   ```bash
   npm run build
   ```
5. **Restart Application Server**:
   ```bash
   npm run start
   ```
   *(Or trigger Vercel / Railway automated deployment pipeline).*

---

## 4. Post-Deployment Verification Checklist

- [ ] **Home Dashboard (`/`)**:
  - Verify page loads cleanly with zero console errors.
  - Scroll to bottom and confirm "Upcoming Events" Google Calendar widget is displayed.
  - Click "Connect Google" to verify modal opens.
- [ ] **Calendar Hub (`/calendar`)**:
  - Open `http://<domain>/calendar`.
  - Toggle between Month, Week, and Agenda views.
  - Verify platform filters (Google Meet, Teams, Zoom, In-Person).
- [ ] **Enquiries Desktop (`/enquiries` on Desktop)**:
  - Open `http://<domain>/enquiries` on desktop browser (`>= 768px`).
  - Confirm desktop table view is intact with all columns (Lead & Contact, Country, Course, Date, Contact Status, Lead Quality, Call Notes, Actions).
  - Test Previous / Next pagination buttons.
- [ ] **Enquiries Mobile (`/enquiries` on Mobile Device / Phone)**:
  - Open `http://<domain>/enquiries` on mobile device (`< 768px`).
  - Verify cards span full screen width with 2-line header.
  - Click card chevron to verify dropdown expands with Phone, Email, Lead ID, Date, Status dropdowns, and Action buttons.
  - Verify horizontal page overflow is completely gone.

---

## 5. Rollback Plan

In the unlikely event of a critical issue during deployment:

1. **Revert Deployment Commit**:
   ```bash
   git revert 8992b82
   ```
2. **Rebuild & Restart**:
   ```bash
   npm run build && npm run start
   ```
3. **Restoration Time**: < 3 minutes.
