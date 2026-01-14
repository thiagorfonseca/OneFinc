import { useMemo } from 'react';
import { OrgProfile, UserRole } from '../types';

export type PermissionCheck =
  | 'canInvite'
  | 'canManageUsers'
  | 'canEditData'
  | 'canViewFinancial';

export function usePermissions(profile: OrgProfile | null) {
  const role: UserRole = profile?.role || 'user';

  const permissions = useMemo(() => {
    const isOwner = role === 'owner';
    const isAdmin = role === 'admin';
    return {
      role,
      isOwner,
      isAdmin,
      canInvite: isOwner || isAdmin,
      canManageUsers: isOwner || isAdmin,
      canEditData: isOwner || isAdmin,
      canViewFinancial: isOwner || isAdmin || role === 'user',
      check: (perm: PermissionCheck) => {
        switch (perm) {
          case 'canInvite':
          case 'canManageUsers':
          case 'canEditData':
            return isOwner || isAdmin;
          case 'canViewFinancial':
            return isOwner || isAdmin || role === 'user';
          default:
            return false;
        }
      },
    };
  }, [role]);

  return permissions;
}
