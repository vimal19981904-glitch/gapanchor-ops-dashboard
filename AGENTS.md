# 🛡️ GAPANCHOR OPS DASHBOARD — AGENT PROTECTION RULES

## Protected Core System Architecture

The following core modules have been fully implemented, authenticated via Microsoft Azure Entra ID, and verified. They are **LOCKED against regression**:

1. **Microsoft Graph Cloud Sync Service** ([`lib/outlook-graph-sync.ts`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/lib/outlook-graph-sync.ts))
   - Direct HTTPS Cloud integration for `contact@gapanchor.com` -> `Demo enquiry!` folder.
   - Unique Graph Message ID deduplication (`whatsappMessageId === msg.id`).
   - Automatic OAuth token refresh and DB token persistence.

2. **Enquiry Intelligence CRM Dashboard** ([`app/enquiries/page.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/app/enquiries/page.tsx))
   - 398+ real-time enquiries loaded with filtering, search, and status controls.
   - **Sync Outlook** manual trigger button accessible to all users.

3. **Dashboard Header & Glossy Liquid Glass Drawer** ([`components/DashboardHeader.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/DashboardHeader.tsx), [`components/NavigationDrawer.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/NavigationDrawer.tsx))
   - Right-side liquid glass navigation trigger button.
   - Right-sliding liquid glass Ops Navigation Drawer.
   - Active Azure AD status badge (`Outlook contact@gapanchor.com`).

4. **System Architecture Documentation** ([`docs/AZURE_GRAPH_CLOUD_ARCHITECTURE.md`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/docs/AZURE_GRAPH_CLOUD_ARCHITECTURE.md))

5. **J.A.R.V.I.S. Voice Engine & Wake-Up System** ([`docs/JARVIS_VOICE_ARCHITECTURE.md`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/docs/JARVIS_VOICE_ARCHITECTURE.md))
   - Continuous background wake-word monitor ("Hey Jarvis", "Wake up", "Wake up Jarvis").
   - Instant zero-pause neural voice streaming (`speakJarvis`) and parallel answer rendering.
   - Core files: `lib/jarvis-listener.ts`, `lib/jarvis-speech.ts`, `components/call-intelligence/FollowUpAssistantBar.tsx`.
   - **PERMANENT SINGLE NEURAL VOICE LOCK (ZERO LOCAL OS/BROWSER VOICE FALLBACK)**: Jarvis must strictly and exclusively output audio using ONE SINGLE NEURAL VOICE: Brian (`en-US-BrianMultilingualNeural`) via Edge-TTS. All fallback to local Windows/browser desktop voices (`Microsoft David`, `Microsoft Zira`, `Samantha`, etc.) is permanently banned. Never switch or alternate voices under any circumstance; if network latency occurs, Jarvis must retry/buffer Brian exclusively without voice switching.
   - **STAGGERED SPEECH PIPELINE & ZERO CHUNK DROPS**: TTS synthesis runs via staggered pre-buffering (Chunk 0 begins immediately, next chunks buffer in background). Chunks must never be silently dropped or skipped (`continue;`), preventing mid-sentence silence pauses.

6. **J.A.R.V.I.S. Living Particle Sphere & Speaking Dust Formation Animation** ([`components/jarvis/JarvisParticleSphere.tsx`](file:///c:/Users/ARUL%20XAVIER/OneDrive%20-%20gapanchor/dashboard/components/jarvis/JarvisParticleSphere.tsx))
   - 3D WebGL Living Particle Sphere, idle/listening/thinking strata and silk ribbons, and speaking harmonics.
   - Word-by-word dust pouring from orb underside, swirling in 3D physics turbulence, and coalescing into glowing cyan words.
   - **LOCKED against modification**: Do NOT touch or alter the particle animation when modifying or adding Jarvis functionalities.

---

## Directives for Future Agent Tasks
- **Do NOT touch or alter** any of the above locked files when building future features.
- All new features must be built in new, modular files to prevent side effects.
- Require double-confirmation before making any edits to protected files.
