# J.A.R.V.I.S. AI Agent — Phased Improvement & Optimization Plan

> **Status:** PLANNING ONLY — Zero application code, schema, or configuration has been modified.  
> **Hard Rule:** ZERO regression across CRM filters, Microsoft/Google Calendar booking & cancellation, Action Items, NTFY alerts, voice input/output (`en-US-BrianMultilingualNeural`), and the deterministic fallback engine.  
> **Protected Files Notice (`AGENTS.md`):** `lib/jarvis-speech.ts`, `lib/jarvis-listener.ts`, `components/jarvis/JarvisParticleSphere.tsx`, `components/call-intelligence/FollowUpAssistantBar.tsx`, and `app/enquiries/page.tsx` are protected. Any modification to `FollowUpAssistantBar.tsx` (Phase 5 / sessionId passing) will require explicit confirmation before editing, and `lib/jarvis-speech.ts` will remain locked to `en-US-BrianMultilingualNeural` with zero chunk drops.

---

## 1. Target Performance & Reliability Metrics

| Metric | Current Baseline (Observed) | Target After Phases 1–4 | Target After Phase 5 |
| :--- | :--- | :--- | :--- |
| **Simple / Fast-Path Queries** (calendar, finance, counts, latest N, single lead) | 3–8s (often triggers LLM or disk/calendar stalls) | **0.2s – 1.2s** (text) | **1.0s – 2.0s** (time-to-first-audio) |
| **Complex LLM Queries** (multi-lead reasoning, synthesis) | 5–12s+ (monolithic 6k-token JSON + sequential TTS) | **2.2s – 3.8s** (text) | **< 4.0s p95** (time-to-first-audio) |
| **Cold Cache / Server Restart Penalty** | +2–6s (sync OneDrive `.docx` disk reads) | **< 0.5s** (DB-only snapshot) | **< 0.5s** |
| **Hung Request Worst-Case** | 15s+ (no `AbortController` on Gemini `fetch`) | **<= 3.5s** (timeout -> fallback) | **<= 3.5s** |

---

## 2. Root-Cause Analysis: Why J.A.R.V.I.S. Repeats the Same Answer

Code inspection revealed **seven concrete defects** across session state, fast-path routing, retrieval scoring, fallback heuristics, and prompt construction that cause different questions to produce identical answers:

### Cause A — Sticky `activeTopicBySession` Without Reset (`app/api/enquiries/ask-ai/route.ts:506-561`)
- `setActiveTopicContext({ topic: 'calendar', ... }, sessionIdStr)` sets the active topic to `'calendar'` (15-minute TTL).
- Lines 553–561 only update `activeTopic` on 4 intents (`isCalendarQuery`, `isActionItemsQuery`, `isMeetingDiscussionQuery`, `isExecutiveFocusQuery`). **There is no `else` branch to reset `activeTopic` when the user switches to a lead, finance, or general question.**
- Consequently, line 511 (`/\btomorrow\b/i.test(prompt) && activeTopic?.topic === 'calendar'`) hijacks any later lead question containing `"tomorrow"` (e.g., *"Remind me to follow up with Arya tomorrow"*) into the Calendar Fast-Path—repeating the exact same calendar readout.

### Cause B — Sticky `pendingBookingsBySession` in `detectPipelineActionType` (`lib/jarvis-pipeline-controller.ts:515-521`)
- `getPendingBookingContext()` is called **without `sessionId`** (reads `'global'`, 15-minute TTL) at `ask-ai/route.ts:450`.
- If an earlier booking prompt lacked a time, **any** subsequent unrelated question containing `"today"`, `"tomorrow"`, `"morning"`, `"afternoon"`, `"evening"`, or a number like `"at 5"` triggers `return 'book_calendar_meeting'`, repeating the booking prompt/confirmation loop.

### Cause C — Shared `'global'` Multi-Turn State Across All Users & Tabs
- Frontend callers (`FollowUpAssistantBar.tsx:438,726,822`, `JarvisHolographicHud.tsx:272`, `DailyPipelineBoard.tsx:874`) do **not** send `sessionId`.
- `ask-ai/route.ts:505` defaults to `'global'`, and `jarvis-pipeline-controller.ts:205,250,286` mirrors every write into `'global'`. Concurrent users or tabs overwrite each other's `activeSubjectLead`, `activeTopicContext`, and `pendingBookingContext`.

### Cause D — Over-Broad Action-Items & Calendar Fast-Paths Returning Static Templates
- `formatActionItemsReportForJarvis` (`lib/action-items.ts:423-469`) returns a **single static overview script** (top 3 demo clients, top 2 pricing, top 3 batch, top 2 retry) for *any* action-item query unless `specificClientQuery`, `overdueOnly`, or `waitingResponseOnly` matches an exact regex. Asking *"What tasks are pending for Blue Yonder?"* or *"Which high-score leads have open checklists?"* produces the exact same canned reply.
- `isCalendarQuery` (`ask-ai/route.ts:515`) intercepts prompts mentioning `schedule` or `upcoming session` unless `lead|candidate|prospect|finances?|revenue` appears—causing training batch schedule queries to repeat Outlook calendar events.

### Cause E — Fallback Engine Stopword Pollution & Hardcoded Names (`ask-ai/route.ts:1032-1384`, `lib/jarvis-pipeline-controller.ts:1691-1740`)
- When Gemini returns 429, `circuitBreakerUntil` locks out LLM calls for **5 minutes** (`lib/gemini-client.ts:94`), sending every question to `fallbackComprehensiveOperations`:
  1. **Hardcoded names**: `evaluateAllCandidatesPriorities()` (`jarvis-pipeline-controller.ts:1721`) outputs hardcoded text (`"Arya Suriyanarayanan ... and Bhuvanesh ... along with Shorya Garg"`) regardless of what the user asked.
  2. **Stopword matching in Branch 7**: Line 1368 runs `q.split(' ').some((w) => w.length > 2 && hay.includes(w))`. Common English words (`"who"`, `"are"`, `"the"`, `"can"`, `"you"`, `"tell"`, `"give"`, `"for"`, `"with"`, `"what"`) match inside lead `notes` / `lastMessage`, returning the top 3 leads in `allLeads` descending order—the **same 3 names** for completely different questions.
  3. **Unfiltered Slices in Branches 1, 2, 4**: Asking for *"recent Blue Yonder leads"* still returns `latestEnquiries.slice(0, 3)` (Branch 1, line 1248); asking about a specific batch returns `activeSessions[0]` (Branch 2, line 1272).

### Cause F — Prompt Construction Bias & Ignored Conversation History (`ask-ai/route.ts:424, 682-929`)
- `FollowUpAssistantBar.tsx:444,732` sends `previousPrompt` and `previousMatchedIds`, and `ask-ai/route.ts:424` destructures them—**but never uses them in Stage 3**!
- `systemPrompt` hardcodes sample client names inside the instructions (`ask-ai/route.ts:886`: `"Sugnan Paul, Pramod P ... Arya ... Hema Sai, Omsai Kumar, Upasana ... Sagar, Shorya Garg"`).
- `evaluatedCandidates` (`line 750-752`) always injects the same top 15 records regardless of the query, and `queryWords` (`line 649`) omits many conversational fillers (`"tell"`, `"give"`, `"list"`, `"find"`, `"please"`, `"check"`, `"leads"`, `"candidates"`), causing `matchedProspects` to surface the same records repeatedly.

### Cause G — Stale UI `aiMatchedIds` When Next Query Returns Empty (`FollowUpAssistantBar.tsx:454, 760`)
- `if (data.matchedIds && data.matchedIds.length > 0)` updates the table filter, but when a subsequent query returns `matchedIds: []`, `onAiMatchedIdsChange` is **not cleared**, leaving the previous leads pinned in the UI table.

---

## 3. Feature Flags Architecture

Every phase is gated by an environment / runtime toggle in a new `lib/jarvis-flags.ts` helper so each behavior can be independently disabled in seconds without a code rollback:

| Flag Name (`.env`) | Default (Safe Rollout) | Controls |
| :--- | :--- | :--- |
| `JARVIS_ENFORCE_AUTH` | `true` (after Phase 1) | Session validation, employee `assignedToId` scoping, demo masking, per-user `sessionId` isolation |
| `JARVIS_LLM_TIMEOUT_MS` | `3500` | `AbortController` timeout per Gemini REST call |
| `JARVIS_INTENT_SCOPED_PROMPT` | `true` (after Phase 2) | Minimal intent-scoped context injection, compact JSON, fixed calendar/topic state |
| `JARVIS_SKIP_LIVE_DISK_SCAN` | `true` (after Phase 3) | Excludes synchronous OneDrive filesystem scans from live `ask-ai` path |
| `JARVIS_EXPANDED_FAST_PATHS` | `true` (after Phase 4) | Deterministic fast-paths (finance, latest N, counts, single lead) + fixed fallback engine |
| `JARVIS_STREAMING_TTS` | `false` -> `true` (Phase 5) | Gemini SSE streaming + sentence-level pipelined TTS trigger |

---

## 4. Phased Implementation Plan (Ordered by Risk)

### Phase 1: Security Hardening, Timeouts & Session State Isolation (Lowest Risk, Highest Criticality)
**Goal:** Close all auth/RBAC/demo leaks, add Gemini `AbortController` timeouts, and stop cross-user/sticky-state answer repetition.

- **Exact Files & Functions to Change:**
  1. **Create `lib/jarvis-flags.ts`**: Centralized feature-flag reader.
  2. **Create `lib/jarvis-auth.ts`**: Reads `gapanchor_session` cookie (via `cookies()`), returns typed `{ userId, role, isDemo, email }`, or `null` if unauthenticated.
  3. **`app/api/enquiries/ask-ai/route.ts` (`POST`)**:
     - When `JARVIS_ENFORCE_AUTH=true`: reject missing session with `401`; derive `sessionIdStr = user.userId` (instead of `'global'`).
     - Pass `{ role: user.role, userId: user.userId, isDemo: user.isDemo }` into `getCachedOperationsSnapshot`, `executeJarvisPipelineAction`, `getClientMeetingDiscussionSummary`, and `getAllLeadActionItemProfiles`.
     - If `user.role === 'employee'`: block finance ledger (`transactions = []`), block trainer payouts/registrations, block calendar booking/cancellation/NTFY alerts, and scope `Enquiry` queries with `assignedToId = user.userId` (per-user cache key `ops_${user.userId}` instead of global singleton!).
     - If `user.isDemo`: apply `maskEnquiriesForDemo()` to lead context and replace real finance/calendar data with `DEMO_CALENDAR_EVENTS` / masked aggregates; block write mutations (same pattern as `call-intelligence/route.ts:45`).
     - **Fix sticky state**: Reset `activeTopicContext` to `'general'` on any non-calendar/non-action/non-meeting prompt; pass `sessionIdStr` into `detectPipelineActionType(prompt, sessionIdStr)` and expire/clear `pendingBookingContext` if the prompt clearly changes topic (e.g., mentions finance, leads, or a different person).
  4. **`lib/jarvis-pipeline-controller.ts`**:
     - `getComprehensiveLeadContext(prisma, scope?)`: accept optional `{ assignedToId?: string }` filter.
     - `getComprehensiveOperationsSnapshot(prisma, scope?)`: omit `financialTransactions` / `trainerRegistrations` / sensitive session financials when `scope?.role === 'employee'`.
     - `detectPipelineActionType(prompt, sessionId)`: stop reading `'global'` fallback when a concrete `sessionId` is passed; remove cross-mirroring to `'global'` in `setActiveSubjectLead`, `setActiveTopicContext`, `setPendingBookingContext`.
  5. **`lib/gemini-client.ts`**:
     - Remove `HARDCODED_GEMINI_KEY` fallback from source (read exclusively from `process.env.GEMINI_API_KEY` / `GOOGLE_AI_KEY` / `GOOGLE_API_KEY`, returning clear config error if absent).
     - Add `AbortController` with `JARVIS_LLM_TIMEOUT_MS` (default `3500ms`) on `fetch(url, { signal })` and cap candidate fallback attempts to at most 2 models (or 1 primary + 1 fallback) so degraded networks fail over in `< 4s` instead of `15s+`.
- **Risk Level:** **Low** (Auth/scoping mirrors existing `sync-excel/route.ts` logic; timeouts fail safely into Stage 4 fallback).
- **How to Test:**
  - Unauthenticated `POST /api/enquiries/ask-ai` returns `401`.
  - Logged in as `employee.a@gapanchor.com`: ask *"How are finances?"* (denied/no private ledger), ask *"Show recent leads"* (only Employee A's `assignedToId` leads returned).
  - Logged in as `demo@gapanchor.com`: verify exported/spoken emails & phones in J.A.R.V.I.S. answers are synthetic `*.demo@gmail.com` / masked numbers.
  - Sequential multi-turn test: Ask *"What's on my calendar?"*, then immediately ask *"Show me leads asking for a demo tomorrow"* ➔ must return leads, NOT repeat the calendar.
  - Simulate slow Gemini endpoint (mock 5s delay) ➔ request aborts at `3.5s` and returns deterministic fallback cleanly.
- **How to Rollback:** Set `JARVIS_ENFORCE_AUTH=false` or `JARVIS_LLM_TIMEOUT_MS=15000` in `.env`, or revert commits to those 3 files.
- **Expected Latency Gain:** Eliminates **10–15s+ hung sockets** (caps worst-case LLM call at **3.5s**).

---

### Phase 2: Intent-Scoped Minimal Context, Tighter Calendar Trigger & Retrieval Hygiene
**Goal:** Cut LLM prompt size by **80–90%**, stop unnecessary calendar fetches, and fix retrieval/prompt bias that causes repeating answers.

- **Exact Files & Functions to Change:**
  1. **`app/api/enquiries/ask-ai/route.ts`**:
     - **Tighter `needsCalendar` regex**: Do NOT set `needsCalendar = true` when the prompt is clearly about CRM leads/enquiries (e.g., `"who asked for a demo"`, `"batch enquiry"`, `"leads from this week"`). Only fetch calendar on `isSystemStatusQuery`, `isExecutiveFocusQuery`, or explicit schedule queries (`/\b(calendar|my schedule|meetings?|events?|appointments?|free slot|today's sessions?)\b/i` when NOT mentioning `lead|candidate|enquir|prospect`).
     - **Intent Classifier & Minimal Prompt Builder (`buildIntentScopedPrompt`)**:
       - Classify prompt into one of: `'finance'`, `'sessions'`, `'trainers'`, `'single_lead'`, `'lead_search'`, `'system_briefing'`, `'general'`.
       - Inject **only** the relevant slice using compact `JSON.stringify(obj)` (no `null, 2` indentation):
         - `'finance'`: `aggregates.finance` + latest 5 `financialTransactions` (~250 tokens).
         - `'sessions'`: latest 8 `activeSessions` (~400 tokens).
         - `'trainers'`: `trainerRegistrations` (~300 tokens).
         - `'single_lead'` / `'lead_search'`: top 8–12 `matchedProspects` + `fullDbFilter.matchedLeads` (capped fields, no `evaluatedCandidates` dump when irrelevant).
         - `'system_briefing'`: compact counts + top 5 `latestEnquiries` + `upcomingCalendarEvents` + `aggregates.finance`.
     - **Fix Prompt Bias & Use `previousPrompt`**:
       - Remove hardcoded example names (`Sugnan Paul`, `Pramod P`, `Arya`, `Hema Sai`, etc.) from `systemPrompt` lines 886.
       - Expand `queryWords` stopword list (exclude `"tell"`, `"give"`, `"list"`, `"find"`, `"please"`, `"check"`, `"leads"`, `"candidates"`, `"details"`, `"status"`, `"phone"`, `"email"`, `"number"`).
       - Include `previousPrompt` (1-line summary) only when the new prompt is a follow-up (`"what about"`, `"his"`, `"her"`, `"their"`, `"more details"`).
  2. **`lib/microsoft-calendar.ts` (`getUnifiedCalendarEvents`)**:
     - Implement **stale-while-revalidate (SWR)**: if `unifiedCalendarCache` exists (even if > 60s old, up to 10 mins), return cached events immediately and trigger a non-blocking background refresh; reduce Google race budget from `6000ms` to `2500ms`.
- **Risk Level:** **Low** (Pure prompt-slimming and trigger refinement; all fast-paths and pipeline actions untouched).
- **How to Test:**
  - Log prompt token/character count before vs. after (expect drop from ~20,000+ chars to ~1,500–3,500 chars).
  - Ask *"Who asked for a demo this week?"* ➔ verify `getUnifiedCalendarEvents` is NOT called (0ms calendar wait).
  - Ask 5 distinct lead questions back-to-back (*"Who is interested in Blue Yonder?"*, *"Any leads from UAE?"*, *"Give me Naga's phone number"*, *"How are finances?"*, *"Who has red flags?"*) ➔ verify 5 distinct, accurate answers with zero name bleed.
- **How to Rollback:** Set `JARVIS_INTENT_SCOPED_PROMPT=false` in `.env` to fall back to the legacy full-context prompt builder.
- **Expected Latency Gain:** **-1.5s to -3.5s** on LLM queries; **-2s to -6s** on lead queries that falsely triggered calendar fetches.

---

### Phase 3: Move Synchronous Disk Scanning Out of Live Requests & Fix Caching
**Goal:** Eliminate 1–4s cold-start/cache-miss stalls caused by synchronous OneDrive `.docx`/`.vtt` filesystem scans inside `ask-ai`.

- **Exact Files & Functions to Change:**
  1. **`lib/transcript-knowledge-engine.ts` (`getTranscriptKnowledgeSnapshot`)**:
     - Add option `{ dbOnly?: boolean }` (controlled by `JARVIS_SKIP_LIVE_DISK_SCAN`).
     - When `dbOnly: true`: query **only** `prisma.leadCall` (fast indexed PostgreSQL query) and skip the `fs.existsSync` / `fs.readdirSync` / `fs.readFileSync` / `extractTextFromDocx` loop across the 5 Windows/OneDrive folders.
     - Export a separate `syncLocalTranscriptsMetadata()` function to run during manual sync (`/api/enquiries/call-intelligence` or Teams Sync button) rather than on live user chat prompts.
     - Increase `SNAPSHOT_CACHE_TTL_MS` from `60s` to `5m` with explicit invalidation (`invalidateTranscriptCache()`) whenever a `LeadCall` or `Enquiry` is mutated.
  2. **`app/api/enquiries/ask-ai/route.ts`**:
     - `getCachedTranscriptSnapshot()` calls `getTranscriptKnowledgeSnapshot(false, { dbOnly: isFlagEnabled('JARVIS_SKIP_LIVE_DISK_SCAN') })`.
     - Increase `CACHE_TTL_MS` for `cachedOpsContext` from `30s` to `120s`, and call `invalidateJarvisOperationsCache()` inside `executeJarvisPipelineAction` and `sync-excel` / `process` mutations (or use SWR so cache expiry refreshes in the background without blocking the active request).
- **Risk Level:** **Low–Medium** (Local un-ingested `.docx` files won't appear in live Jarvis answers until synced into `LeadCall` or scanned by the background/manual sync trigger; all ingested transcripts in `LeadCall` remain 100% searchable).
- **How to Test:**
  - Clear cache / restart dev server, send first `ask-ai` query, measure DB/context load time (target `< 300ms` vs. `1.5–4s` previously).
  - Verify all `LeadCall` transcript summaries, quotes, and CX checklists still appear accurately in J.A.R.V.I.S. answers.
- **How to Rollback:** Set `JARVIS_SKIP_LIVE_DISK_SCAN=false` in `.env` to restore live filesystem scanning immediately.
- **Expected Latency Gain:** **-1.0s to -3.5s** on cache misses and cold starts.

---

### Phase 4: Expand Zero-LLM Fast-Paths & Fix Deterministic Fallback Engine
**Goal:** Answer straightforward queries in **< 400ms** server-side without an LLM round-trip, and eliminate repeating fallback answers when Gemini is offline/rate-limited.

- **Exact Files & Functions to Change:**
  1. **`app/api/enquiries/ask-ai/route.ts` (Stage 2 Fast-Paths)**:
     - Add deterministic fast-paths (gated by `JARVIS_EXPANDED_FAST_PATHS=true`):
       - **Pure Finance Queries** (`isFinanceOnlyQuery`): Return `numberToIndianWords` summary directly from `opsContext.aggregates.finance` (zero LLM wait!).
       - **Pure Course / Country / Total Count Queries** (e.g. *"How many Manhattan WMS leads do we have?"*, *"How many leads from USA?"*): Compute exact count + top 3 recent names directly from `opsContext.allLeads`.
       - **Latest N Leads Queries** (e.g. *"Show latest 3 leads"* or *"Recent Blue Yonder enquiries"*): Filter by any course/country qualifier in prompt first, then return top 3–5.
       - **Direct Single-Lead Contact / Status Lookup** (e.g. *"What is Naga's phone number?"* / *"Status of Arya?"*): When `resolveLeadFromPrompt` finds an exact unique match and asks for phone/email/status/course/notes, answer directly in `< 200ms`.
  2. **`app/api/enquiries/ask-ai/route.ts` (`fallbackComprehensiveOperations`) & `lib/jarvis-pipeline-controller.ts` (`evaluateAllCandidatesPriorities`)**:
     - Remove hardcoded names (`"Arya Suriyanarayanan ... Bhuvanesh ... Shorya Garg"`) from `evaluateAllCandidatesPriorities`; format dynamically from `tier1` array (`tier1.slice(0, 3).map(...)`).
     - In Branch 7 (general fallback), reuse the clean stopword-filtered `queryWords` scorer instead of `q.split(' ')`, and sort by `matchScore` descending so different questions return genuinely different leads (or `"I couldn't find a matching lead..."` if 0 real token matches).
     - In `lib/action-items.ts` (`formatActionItemsReportForJarvis`): add course/track filtering (`options?.courseFilter`) so *"action items for Blue Yonder"* filters profiles rather than returning the same generic top-3 overview.
- **Risk Level:** **Medium** (Fast-path regexes must be carefully scoped so complex analytical/comparative questions like *"Compare conversion quality between Manhattan and Blue Yonder leads with notes"* still route to Gemini).
- **How to Test:**
  - Test fast-paths with Gemini key temporarily disabled / circuit breaker tripped AND with Gemini enabled:
    - *"How are the finances?"* ➔ `< 300ms`, exact revenue numbers.
    - *"Latest 3 Blue Yonder leads"* ➔ `< 300ms`, only Blue Yonder leads.
    - *"What is [Candidate]'s phone number?"* ➔ `< 300ms`, exact phone number.
    - Complex analytical prompt (*"Why are USA leads stalling after demo?"*) ➔ still routes to Gemini Stage 3.
  - Test gibberish/unmatched fallback query ➔ must NOT repeat top 3 leads; must report no matches cleanly.
- **How to Rollback:** Set `JARVIS_EXPANDED_FAST_PATHS=false` in `.env` so all non-calendar/non-action queries continue to Stage 3 Gemini.
- **Expected Latency Gain:** **-2.5s to -4.5s** on ~60–70% of everyday operational queries (total server time drops to **100–400ms**).

---

### Phase 5: Gemini SSE Streaming + Pipelined Sentence-Level TTS (Protected-File Confirmation Required)
**Goal:** Eliminate the sequential LLM-wait ➔ TTS-wait waterfall so complex LLM queries start speaking in **1.5–2.5s** instead of **5–10s**.

> **Protected File Confirmation Gate**: Phase 5 requires editing `components/call-intelligence/FollowUpAssistantBar.tsx` (and optionally adding a streaming helper without changing voice lock or chunk retention in `lib/jarvis-speech.ts`). Under `AGENTS.md`, explicit double-confirmation from you will be requested before modifying `FollowUpAssistantBar.tsx`.

- **Exact Files & Functions to Change:**
  1. **`lib/gemini-client.ts`**:
     - Add `streamGeminiText(prompt, options)` calling `:streamGenerateContent?alt=sse`, yielding delta text chunks. (For simplicity and speed, instruct Gemini to stream plain spoken prose first, followed by a compact `---METADATA---` JSON trailer with `matchedIds` and `recommendedFilter`—so Sentence 1 is immediately human-readable without waiting for full JSON closing braces!).
  2. **Create `app/api/enquiries/ask-ai-stream/route.ts`** (Additive new endpoint—leaves `ask-ai/route.ts` 100% intact as fallback):
     - Runs the same Phase 1–4 auth, RBAC, fast-paths, and minimal context.
     - For fast-paths: emits answer immediately in 1 SSE event.
     - For LLM paths: streams each completed sentence (`[.!?]\s`) as an SSE `sentence` event, followed by a `done` event containing `matchedIds`, `recommendedFilter`, and `pipelineAction`.
  3. **`components/call-intelligence/FollowUpAssistantBar.tsx`** *(upon explicit approval)*:
     - When `NEXT_PUBLIC_JARVIS_STREAMING_TTS=true`: consume `/api/enquiries/ask-ai-stream`.
     - As soon as Sentence 1 arrives (~500–900ms), immediately pre-fetch/play Chunk 0 via `/api/ai/speak` (`en-US-BrianMultilingualNeural`) while subsequent sentences continue streaming and queuing into `speakJarvis` without dropping any chunk.
     - Also clear `onAiMatchedIdsChange(null)` when a non-filter query explicitly returns `matchedIds: []`, and pass a persistent per-tab/per-user `sessionId`.
- **Risk Level:** **Medium–High** (Touches SSE parsing, incremental audio queuing, and `FollowUpAssistantBar.tsx` UI state; strictly isolated behind `JARVIS_STREAMING_TTS` flag + additive new `/api/enquiries/ask-ai-stream` route).
- **How to Test:**
  - Verify Chunk 0 plays with **zero mid-sentence pauses or dropped chunks** (`en-US-BrianMultilingualNeural` exclusively).
  - Verify `matchedIds` still filter the `/enquiries` table on `done` event.
  - Verify interrupting speech (`stopJarvis()`) cleanly aborts the SSE reader (`AbortController`).
- **How to Rollback:** Set `JARVIS_STREAMING_TTS=false` (and `NEXT_PUBLIC_JARVIS_STREAMING_TTS=false`); the UI instantly reverts to the standard `/api/enquiries/ask-ai` endpoint.
- **Expected Latency Gain:** **-1.5s to -3.0s** perceived time-to-first-audio on complex LLM queries (**p95 < 4s**).

---

## 5. Quick Wins (Ship Today) vs. Bigger Refactors

| Category | Item | Effort | Impact |
| :--- | :--- | :--- | :--- |
| **Quick Win (Today)** | Fix sticky `activeTopic` & `pendingBooking` hijacking + `sessionId` scoping (Phase 1) | Small | Stops ~80% of repeating-answer bugs immediately |
| **Quick Win (Today)** | Add `gapanchor_session` auth, employee `assignedToId` filter, and demo masking to `ask-ai` (Phase 1) | Small | Closes critical data/PII leak |
| **Quick Win (Today)** | Add `3.5s` `AbortController` timeout to `lib/gemini-client.ts` (Phase 1) | Tiny | Eliminates 10–15s+ hung requests |
| **Quick Win (Today)** | Tighten `needsCalendar` regex + compact `JSON.stringify` + strip hardcoded prompt names (Phase 2) | Small | Cuts 2–6s calendar waits & ~40% tokens |
| **Quick Win (Today)** | Disable live OneDrive disk scan inside `ask-ai` via `JARVIS_SKIP_LIVE_DISK_SCAN=true` (Phase 3) | Small | Cuts 1–4s cold-cache stalls |
| **Medium Refactor** | Expand zero-LLM fast-paths + rewrite fallback stopword scorer (Phase 4) | Medium | Drops simple queries to **< 400ms** server-side |
| **Bigger Refactor** | Gemini SSE streaming + sentence-level pipelined TTS via `/api/enquiries/ask-ai-stream` (Phase 5) | Large | Brings complex LLM voice responses under **2–4s p95** |

---

## 6. Mandatory Per-Phase Regression Checklist

Run and verify every item below after each phase:

- [ ] **CRM Table Filters & Search**: Country, Course, Quality, Status, Smart Follow-Up pills, and AI `matchedIds` filtering on `/enquiries` work identically; clearing AI filter restores full table.
- [ ] **Pipeline Board Actions**: *"Push due enquiries to pipeline"*, *"Push top priorities"*, *"Move [Name] to negotiating"*, *"Remove lost leads"* update `DailyPipelineBoard` via `gapanchor:pipeline-action`.
- [ ] **Calendar Read, Book & Cancel**: *"What's on my calendar today?"*, *"What about tomorrow?"*, *"Book a meeting with [Name] at 5 PM"*, *"Cancel the 5 PM meeting"* succeed on Microsoft Graph / Google Calendar.
- [ ] **Action Items & Meeting Notes**: *"What action items are pending?"*, *"What did we discuss with [Name]?"*, *"Who is overdue?"* return accurate CRM checklists.
- [ ] **NTFY Push Alerts**: *"Send pipeline due notifications"* dispatches consolidated mobile alert cleanly.
- [ ] **Voice Input & Output**: Wake-word (`"Hey Jarvis"`), Web Speech API + MediaRecorder fallback (`/api/ai/transcribe`), and single neural voice **Brian (`en-US-BrianMultilingualNeural`)** with zero chunk drops and WebGL particle sphere harmonics work smoothly.
- [ ] **Fallback Engine**: With `GEMINI_API_KEY` invalid or 429 tripped, deterministic fallback answers without crashing and without repeating canned names across different queries.
- [ ] **Permissions & Demo Isolation**: Employees cannot read global leads or finance/payouts via J.A.R.V.I.S.; Demo account sees only masked names/emails/phones.

---

### Approval Gate
No files have been modified. Please review this plan and confirm if you would like to proceed starting with **Phase 1 (Security, Timeouts & Session State Isolation)**—and note that we will request explicit confirmation again before touching `FollowUpAssistantBar.tsx` in Phase 5.
