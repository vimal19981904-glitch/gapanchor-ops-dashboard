import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import {
  MASTER_ADMIN_EMAIL,
  SYSTEM_MODULES,
  SessionUser,
  ModuleId,
  isMasterAdminProtected,
} from './rbac-constants';

export {
  MASTER_ADMIN_EMAIL,
  SYSTEM_MODULES,
  isMasterAdminProtected,
};
export type { SessionUser, ModuleId };

/**
 * Extracts the authenticated user from the gapanchor_session cookie.
 */
export function getSessionUser(req?: Request): SessionUser | null {
  try {
    let cookieValue: string | undefined;

    if (req) {
      const cookieHeader = req.headers.get('cookie') || '';
      const match = cookieHeader.match(/gapanchor_session=([^;]+)/);
      if (match) {
        cookieValue = decodeURIComponent(match[1]);
      }
    }

    if (!cookieValue) {
      const cookieStore = cookies();
      const c = cookieStore.get('gapanchor_session');
      cookieValue = c?.value;
    }

    if (!cookieValue) return null;

    const parsed = JSON.parse(cookieValue) as SessionUser;
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Checks if a user has permission to view or interact with a given module.
 */
export function canAccessModule(user: SessionUser | null, moduleId: string): boolean {
  if (!user) return false;
  
  // Account disabled check
  if (user.isActive === false) return false;

  // Master Admin has unrestricted access to EVERYTHING
  if (user.role === 'admin' || user.email.toLowerCase() === MASTER_ADMIN_EMAIL) {
    return true;
  }

  // Demo account has showcase access to general modules, but NEVER to credentials
  if (user.role === 'DEMO' || user.isDemo) {
    return moduleId !== 'credentials';
  }

  // Credentials management is strictly reserved for Master Admin
  if (moduleId === 'credentials') {
    return false;
  }

  // Employees require explicit inclusion in allowedUIs
  const allowed = user.allowedUIs || ['enquiries'];
  if (allowed.includes('*')) return true;
  return allowed.includes(moduleId);
}

/**
 * Helper to record an administrative action in the AuditLog.
 */
export async function recordAuditLog({
  actor,
  action,
  targetUserId,
  targetEmail,
  details,
  ipAddress,
}: {
  actor: SessionUser;
  action: string;
  targetUserId?: string;
  targetEmail?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorName: actor.name,
        action,
        targetUserId,
        targetEmail,
        details: details || {},
        ipAddress: ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
