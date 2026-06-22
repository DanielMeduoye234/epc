import { UserRole } from './types';

/**
 * Centralized role-based access control for the app.
 * All pages and components should reference this config
 * instead of doing scattered role checks.
 */

export type Permission =
  | 'dashboard.view'
  | 'new_believers.view'
  | 'new_believers.create'
  | 'new_believers.edit'
  | 'first_timers.view'
  | 'first_timers.edit'
  | 'members.view'
  | 'members.create'
  | 'members.edit'
  | 'bacentas.view'
  | 'bacentas.manage'
  | 'attendance.view'
  | 'attendance.mark'
  | 'attendance.analytics'
  | 'birthdays.view'
  | 'birthdays.send'
  | 'epc_news.view'
  | 'epc_news.create'
  | 'prayers.view'
  | 'prayers.manage'
  | 'settings.view'
  | 'settings.manage_users';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  bishop: [
    'dashboard.view',
    'new_believers.view',
    'new_believers.create',
    'new_believers.edit',
    'first_timers.view',
    'first_timers.edit',
    'members.view',
    'members.create',
    'members.edit',
    'bacentas.view',
    'bacentas.manage',
    'attendance.view',
    'attendance.mark',
    'attendance.analytics',
    'birthdays.view',
    'birthdays.send',
    'epc_news.view',
    'epc_news.create',
    'prayers.view',
    'prayers.manage',
    'settings.view',
    'settings.manage_users',
  ],
  super_admin: [
    'dashboard.view',
    'new_believers.view',
    'new_believers.create',
    'new_believers.edit',
    'first_timers.view',
    'first_timers.edit',
    'members.view',
    'members.create',
    'members.edit',
    'bacentas.view',
    'bacentas.manage',
    'attendance.view',
    'attendance.mark',
    'attendance.analytics',
    'birthdays.view',
    'birthdays.send',
    'epc_news.view',
    'epc_news.create',
    'prayers.view',
    'prayers.manage',
    'settings.view',
    'settings.manage_users',
  ],
  shepherd: [
    'dashboard.view',
    'members.view',
    'members.create',
    'members.edit',
    'attendance.view',
    'attendance.mark',
  ],
  recorder: [
    'dashboard.view',
    'new_believers.view',
    'new_believers.create',
    'new_believers.edit',
    'first_timers.view',
    'first_timers.edit',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ANY of the listed permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Navigation items with their required permissions.
 * Used by Sidebar and any navigation component.
 */
export const NAV_PERMISSIONS: Record<string, Permission[]> = {
  '/dashboard': ['dashboard.view'],
  '/dashboard/new-believers': ['new_believers.view'],
  '/dashboard/first-timers': ['first_timers.view'],
  '/dashboard/members': ['members.view'],
  '/dashboard/bacentas': ['bacentas.view'],
  '/dashboard/attendance': ['attendance.view'],
  '/dashboard/birthdays': ['birthdays.view'],
  '/dashboard/epc-news': ['epc_news.view'],
  '/dashboard/prayers': ['prayers.view'],
  '/dashboard/settings': ['settings.view'],
};

/**
 * Check if a role can access a given route
 */
export function canAccessRoute(role: UserRole, route: string): boolean {
  const requiredPermissions = NAV_PERMISSIONS[route];
  if (!requiredPermissions) return true; // No restriction defined
  return hasAnyPermission(role, requiredPermissions);
}
