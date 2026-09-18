import type { Role } from '@/lib/database.types';

/**
 * Role helpers. platform_admin is a superset of leadership (full permissions,
 * and the future cross-org owner), so leadership-gated UI treats both the same.
 * Centralized here so every guard/check stays consistent.
 */
export function isLeader(role: Role | undefined | null): boolean {
  return role === 'leadership' || role === 'platform_admin';
}

export function isPlatformAdmin(role: Role | undefined | null): boolean {
  return role === 'platform_admin';
}
