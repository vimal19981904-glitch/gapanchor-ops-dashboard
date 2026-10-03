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

---

## Directives for Future Agent Tasks
- **Do NOT touch or alter** any of the above locked files when building future features.
- All new features must be built in new, modular files to prevent side effects.
- Require double-confirmation before making any edits to protected files.
