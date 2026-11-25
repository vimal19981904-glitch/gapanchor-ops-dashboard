export const MASTER_ADMIN_EMAIL = 'admin@gapanchor.com';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'administrator' | 'employee' | 'DEMO';
  assignedCourse?: string | null;
  allowedUIs?: string[];
  isActive?: boolean;
  isDemo?: boolean;
  accountType?: string;
}

export const SYSTEM_MODULES = [
  { id: 'enquiries', label: 'Enquiry Intelligence CRM', path: '/enquiries', defaultLocked: false },
  { id: 'calendar', label: 'GapAnchor Calendar', path: '/calendar', defaultLocked: true },
  { id: 'training', label: 'Training Operations & Trainers', path: '/training', defaultLocked: true },
  { id: 'finance', label: 'Finance Intelligence', path: '/finance/analytics', defaultLocked: true },
  { id: 'ops', label: 'Ops Peak Analytics', path: '/ops-analytics', defaultLocked: true },
  { id: 'job-support', label: 'Job Support Operations', path: '/job-support', defaultLocked: true },
] as const;

export type ModuleId = typeof SYSTEM_MODULES[number]['id'] | 'credentials' | 'dev' | 'setup';

/**
 * Checks if a user has permission to view or interact with a given module.
 */
export function canAccessModule(user: SessionUser | null, moduleId: string): boolean {
  if (!user) return false;
  
  if (user.isActive === false) return false;

  if (user.role === 'admin' || user.email.toLowerCase() === MASTER_ADMIN_EMAIL) {
    return true;
  }

  if (user.role === 'DEMO' || user.isDemo) {
    return moduleId !== 'credentials';
  }

  if (moduleId === 'credentials') {
    return false;
  }

  const allowed = user.allowedUIs || ['enquiries'];
  if (allowed.includes('*')) return true;
  return allowed.includes(moduleId);
}

/**
 * Immutable Master Admin check.
 * admin@gapanchor.com can never be deleted, demoted, or deactivated.
 */
export function isMasterAdminProtected(email: string): boolean {
  return email.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}
