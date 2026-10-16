import { describe, it, expect } from 'vitest';
import { getPrimaryRole, getRoleLabel } from './roles';
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
});
