import { describe, it, expect } from 'vitest';
import { getPrimaryRole, getRoleLabel } from './roles';
import {
  assertCanAssignRole,
  assertCanCreateUsers,
  assertCanManageTarget,
  normalizeRole,
  type RequesterContext,
  type TargetContext,
} from '../../supabase/functions/_shared/authz';
import type { UserRole } from '@/types';

describe('roles utility', () => {
  describe('getPrimaryRole', () => {
    it('returns the highest priority role when user has multiple roles', () => {
      expect(getPrimaryRole(['volunteer', 'admin'])).toBe('admin');
      expect(getPrimaryRole(['volunteer', 'supervisor', 'committee_leader'])).toBe('supervisor');
      expect(getPrimaryRole(['volunteer', 'hr'])).toBe('hr');
    });

    it('defaults to volunteer if list is empty or unrecognized', () => {
      expect(getPrimaryRole([])).toBe('volunteer');
      expect(getPrimaryRole(['unknown_role' as unknown as UserRole])).toBe('volunteer');
    });
  });

  describe('getRoleLabel', () => {
    it('returns correct Arabic labels when isRTL is true', () => {
      expect(getRoleLabel('volunteer', true)).toBe('متطوع');
      expect(getRoleLabel('admin', true)).toBe('مسؤول');
      expect(getRoleLabel('supervisor', true)).toBe('هيد الفرع');
      expect(getRoleLabel('committee_leader', true)).toBe('هيد اللجنة');
      expect(getRoleLabel('branch_admin', true)).toBe('مسؤول الفرع');
      expect(getRoleLabel('executive', true)).toBe('تنفيذي');
      expect(getRoleLabel('hr', true)).toBe('الموارد البشرية');
    });

    it('returns correct English labels when isRTL is false', () => {
      expect(getRoleLabel('volunteer', false)).toBe('Volunteer');
      expect(getRoleLabel('admin', false)).toBe('Admin');
      expect(getRoleLabel('supervisor', false)).toBe('Head of Branch');
      expect(getRoleLabel('committee_leader', false)).toBe('Committee Head');
      expect(getRoleLabel('branch_admin', false)).toBe('Branch Admin');
      expect(getRoleLabel('executive', false)).toBe('Executive');
      expect(getRoleLabel('hr', false)).toBe('HR');
    });

    it('handles undefined or null role gracefully', () => {
      expect(getRoleLabel(null, true)).toBe('متطوع');
      expect(getRoleLabel(undefined, false)).toBe('Volunteer');
    });

    it('formats unmapped roles nicely', () => {
      expect(getRoleLabel('custom_role', false)).toBe('custom role');
    });
  });

  describe('Edge Function AuthZ Boundaries', () => {
    const branchA = '11111111-1111-1111-1111-111111111111';
    const branchB = '22222222-2222-2222-2222-222222222222';

    it('prevents non-global-admins from assigning admin or executive roles', () => {
      const committeeLeader: RequesterContext = {
        id: 'leader-1',
        roles: ['committee_leader'],
        branchId: branchA,
      };
      const branchAdmin: RequesterContext = {
        id: 'badmin-1',
        roles: ['branch_admin'],
        branchId: branchA,
      };
      const globalAdmin: RequesterContext = {
        id: 'admin-1',
        roles: ['admin'],
        branchId: branchA,
      };

      expect(() => assertCanAssignRole(committeeLeader, 'admin')).toThrow(/only global admins/);
      expect(() => assertCanAssignRole(committeeLeader, 'committee_leader')).toThrow(/only branch or HR managers/);
      expect(() => assertCanAssignRole(committeeLeader, 'volunteer')).not.toThrow();
      expect(() => assertCanAssignRole(branchAdmin, 'committee_leader')).not.toThrow();
      expect(() => assertCanAssignRole(branchAdmin, 'admin')).toThrow(/only global admins/);
      expect(() => assertCanAssignRole(globalAdmin, 'admin')).not.toThrow();
    });

    it('prevents volunteers and cross-branch or lower-role managers from managing protected targets', () => {
      const volunteerRequester: RequesterContext = {
        id: 'vol-1',
        roles: ['volunteer'],
        branchId: branchA,
      };
      const committeeLeaderRequester: RequesterContext = {
        id: 'leader-1',
        roles: ['committee_leader'],
        branchId: branchA,
      };
      const hrRequester: RequesterContext = {
        id: 'hr-1',
        roles: ['hr'],
        branchId: branchA,
      };

      const adminTarget: TargetContext = {
        id: 'admin-target',
        roles: ['admin'],
        branchId: branchA,
        isAshbal: false,
      };
      const peerLeaderTarget: TargetContext = {
        id: 'leader-target',
        roles: ['committee_leader'],
        branchId: branchA,
        isAshbal: false,
      };
      const sameBranchVolunteer: TargetContext = {
        id: 'vol-target',
        roles: ['volunteer'],
        branchId: branchA,
        isAshbal: false,
      };
      const otherBranchVolunteer: TargetContext = {
        id: 'vol-other-branch',
        roles: ['volunteer'],
        branchId: branchB,
        isAshbal: false,
      };

      expect(() => assertCanCreateUsers(volunteerRequester)).toThrow(/user creation access required/);
      expect(() => assertCanManageTarget(volunteerRequester, sameBranchVolunteer)).toThrow(/user creation access required/);
      expect(() => assertCanManageTarget(committeeLeaderRequester, adminTarget)).toThrow(/only global admins/);
      expect(() => assertCanManageTarget(committeeLeaderRequester, peerLeaderTarget)).toThrow(/only branch or HR managers/);
      expect(() => assertCanManageTarget(committeeLeaderRequester, otherBranchVolunteer)).toThrow(/outside your branch scope/);
      expect(() => assertCanManageTarget(committeeLeaderRequester, sameBranchVolunteer)).not.toThrow();
      expect(() => assertCanManageTarget(hrRequester, peerLeaderTarget)).not.toThrow();
      expect(() => assertCanManageTarget(hrRequester, adminTarget)).toThrow(/only global admins/);
    });

    it('validates role normalization strictly', () => {
      expect(normalizeRole(undefined)).toBe('volunteer');
      expect(normalizeRole('volunteer')).toBe('volunteer');
      expect(() => normalizeRole('super_root')).toThrow(/Invalid role requested/);
    });
  });
});
