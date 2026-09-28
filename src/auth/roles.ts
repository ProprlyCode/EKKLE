import type { Role } from '@/lib/database.types';

/**
 * Ministry roles (docs/accounts-and-roles.md): Admin ⊃ Leader ⊃ Member.
 * The platform team is separate (platform_team) and never a ministry role.
 * Centralized here so every guard/check stays consistent.
 */
export function isLeader(role: Role | undefined | null): boolean {
  return role === 'admin' || role === 'leader';
}

export function isAccountAdmin(role: Role | undefined | null): boolean {
  return role === 'admin';
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  leader: 'Leader',
  member: 'Member',
};
