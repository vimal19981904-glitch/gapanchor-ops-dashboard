-- 🛡️ RBAC & CREDENTIALS EMERGENCY DOWN-MIGRATION ROLLBACK SCRIPT
-- Safely removes newly added columns and tables without touching enquiries, transactions, or sessions.

ALTER TABLE "User" DROP COLUMN IF EXISTS "allowedUIs";
ALTER TABLE "User" DROP COLUMN IF EXISTS "isActive";

DROP TABLE IF EXISTS "AuditLog";
