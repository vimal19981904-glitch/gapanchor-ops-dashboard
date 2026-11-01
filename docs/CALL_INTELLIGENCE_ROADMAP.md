# 🎙️ Teams Call Intelligence & CRM Automation — System Architecture & Upcoming Roadmap

> **Module**: GapAnchor Ops Dashboard — Lead Call Intelligence & Scoring Pipeline  
> **Status**: ✅ Milestone 1 Complete & Verified in Production  
> **Primary Key Architecture**: Microsoft Graph Calendar Event Bridge + Multi-Tier Cascade  
> **Date**: October 19, 2026  

---

## 1. Executive Summary & Accomplishments Today

We successfully architected, implemented, and verified the complete **Teams Call Intelligence & Lead-Call Automation Pipeline**:

1. **Volume Meter & UI Column Modernization**:
   - Replaced the legacy `LEAD QUALITY` column on `/enquiries` with the interactive **`CALL SCORE`** column powered by `CallVolumeMeter.tsx`.
   - Displays dynamic indicators: `⚪ Unrated` for unscored leads or `X/10 Score` with color-coded badges and volume bars.
   - Cleaned up inline slider clutter next to candidate names.

2. **Teams Sync & Upload Controls**:
   - Integrated `[Paste / Upload Transcript]` and `[Sync Teams Calls]` buttons into the CRM action bar next to `[Sync Outlook]`.
   - Allows instant drag-and-drop of `.docx` transcript files or manual dialogue pasting with live AI preview.

3. **Microsoft Graph Calendar Event Bridge (The Gold Standard Primary Key)**:
   - **The Challenge Solved**: Teams meeting transcripts only contain meeting titles and dialogue (no email or phone). Candidate forms often use abbreviated names (e.g. `"Arya S"`), while transcripts use full names (e.g. `"Arya Suriyanarayanan"`), which previously created duplicate records.
   - **The Solution**: Connected directly to Microsoft Graph `/me/calendarView` to retrieve the Outlook calendar appointment linked to the meeting. The calendar attendee provides the verified candidate email (`aryasuriyanarayanan@gmail.com`), linking with 100% precision to the existing CRM lead.
   - **Verified Live**: Successfully processed candidate **Arya S**, evaluated her transcript to **6/10 Score**, set status to **`Talked`**, generated Sales Battlecards, and produced **ZERO duplicates**.

---

## 2. Primary Key Resolution Architecture

```mermaid
flowchart TD
    A["Teams Transcript (.docx / VTT)<br>Title: 'IT support & Training - Candidate Name'"] --> B{"Resolution Cascade"}

    B -->|"Tier 1: Calendar Bridge (Primary Key)"| C["Microsoft Graph /me/calendarView<br>Subject matches meeting title<br>Extract external attendee email"]
    C --> G["CRM Match by Email: prisma.enquiry.findFirst({ email })"]

    B -->|"Tier 2: Email Handle Heuristic"| D["Normalize name: 'aryasuriyanarayanan'<br>Matches email prefix: aryasuriyanarayanan@gmail.com"]
    D --> G

    B -->|"Tier 3: First-Name Proximity"| E["First Name Token: 'Arya'<br>Active lead in last 7 days (Pending/Open)"]
    E --> G

    B -->|"Tier 4: Exact Name Match"| F["Exact match: participantName"]
    F --> G

    G --> H["✅ Update Existing Lead<br>Score: 6/10 | Status: Talked<br>Attach LeadCall Timeline<br>ZERO Duplicates"]
    B -->|"No Match Anywhere"| I["Create New Lead (teams_call_transcript)"]
```

---

## 3. Core Modules & File Reference

| Module | File Path | Role & Status |
| :--- | :--- | :--- |
| **Calendar Matcher & Resolver** | [`lib/bookings-transcript-matcher.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/lib/bookings-transcript-matcher.ts) | Implements `matchCalendarEventToTranscript` & `resolveTargetEnquiry` 4-tier cascade. |
| **Teams Sync API** | [`app/api/teams/sync-transcripts/route.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/app/api/teams/sync-transcripts/route.ts) | Scans local folders & Graph online meetings; links transcripts via Calendar Bridge. |
| **Manual Transcript API** | [`app/api/leads/process-transcript/route.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/app/api/leads/process-transcript/route.ts) | Handles paste/upload modal submissions with duplicate prevention. |
| **Docx Text Extractor** | [`lib/docx-extractor.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/lib/docx-extractor.ts) | Extracts clean dialogue text from Teams Word `.docx` meeting recaps. |
| **AI Analyzer & Scorer** | [`lib/transcript-ai-analyzer.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/lib/transcript-ai-analyzer.ts) | Evaluates Need (30%), Budget (30%), Timeline (20%), Decision Maker (20%) + generates battlecards. |
| **Call Volume Meter UI** | [`components/call-intelligence/CallVolumeMeter.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/call-intelligence/CallVolumeMeter.tsx) | Renders color-coded 1–10 volume score badges in CRM table. |
| **Teams Sync Controls UI** | [`components/call-intelligence/TeamsSyncControls.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/call-intelligence/TeamsSyncControls.tsx) | Action bar controls for `[Paste / Upload]` and `[Sync Teams Calls]`. |
| **Lead Details Drawer** | [`components/call-intelligence/LeadDetailsDrawer.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/call-intelligence/LeadDetailsDrawer.tsx) | Multi-call history, verbatim quotes, battlecards, and 1-click WhatsApp button. |

---

## 4. Upcoming Roadmap & Next Actions (For Next Session)

When resuming work, here are the recommended initiatives ready for implementation:

### 1. Hands-Free Automated Background Cron Sync
- **Current State**: Transcripts are synced on-demand via the `[Sync Teams Calls]` button.
- **Proposed Feature**: Background cron job (e.g. running every 15–30 minutes) that silently scans OneDrive/Downloads and Graph calendar for newly finished calls and updates lead scores hands-free.

### 2. Follow-Up Due Date Filters & Alert Banner
- **Current State**: The AI calculates `callFollowUpDate` (stored on `Enquiry`).
- **Proposed Feature**:
  - Add quick filter tabs in the CRM: `All`, `Due for Callback Today`, `High Intent (8-10)`, `Talked`.
  - Display an overdue badge or reminder banner for high-intent leads requiring immediate follow-up.

### 3. WhatsApp Deep-Link Followup Optimization
- **Current State**: AI produces custom `whatsappDraft` tailored to candidate needs.
- **Proposed Feature**: Polish WhatsApp Web / Desktop deep-link triggers with customized template variables (course syllabus link, sandbox schedule).

### 4. Executive Call Intelligence Analytics Strip
- **Proposed Feature**: Top-of-page metrics widget on `/enquiries`:
  - **Average Call Quality Score** (e.g. 6.4/10)
  - **Conversion Velocity** (Hours from `Pending` $\to$ `Talked` $\to$ `Converted`)
  - **Red Flag Alert Count** (candidates flagged with conflicting constraints)

---

> **System Protection Reminder**: Under [`AGENTS.md`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/AGENTS.md), protected core files (`lib/outlook-graph-sync.ts`, `components/DashboardHeader.tsx`, `components/NavigationDrawer.tsx`, `app/enquiries/page.tsx`) remain locked and isolated from side effects.
