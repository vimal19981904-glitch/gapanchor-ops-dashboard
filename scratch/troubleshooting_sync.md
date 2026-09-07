# Sync Outlook & Excel Troubleshooting

## Issue description
When clicking the "Sync Outlook & Excel" button on the Vercel app (production), an error toast appears indicating that an Excel file could not be found at any of the candidate local paths (e.g. `C:\Users\ARUL XAVIER\OneDrive - gapanchor\Desktop\...`).

## Plan
1. Use the `browser_subagent` to navigate to the production app and reproduce the error.
2. Collect the logs and find the API route responsible for the sync.
3. Fix the hardcoded local file paths in the API route, as Vercel (cloud environment) does not have access to the user's local file system. We likely need to adjust how the data is synced (e.g., via an upload, or reading from a cloud storage service, or fixing a hardcoded dev path).
