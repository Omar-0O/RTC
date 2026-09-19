import { describe, it, expect } from 'vitest';
import {
  ALL_FEATURES,
  GROUP_SUBMISSION_LEADER_ROLES,
  getRoleDefaultFeatures,
  canSubmitGroupActivity,
} from './userFeatures';

describe('userFeatures utility', () => {
  it('includes group_submission in ALL_FEATURES', () => {
    const groupFeature = ALL_FEATURES.find((f) => f.id === 'group_submission');
    expect(groupFeature).toBeDefined();
    expect(groupFeature?.label).toBe('المشاركة الجماعية');
    expect(groupFeature?.labelEn).toBe('Group Submission');
  });

  it('provides group_submission as role default for leader roles', () => {
    expect(getRoleDefaultFeatures('admin')).toContain('group_submission');
    expect(getRoleDefaultFeatures('branch_admin')).toContain('group_submission');
    expect(getRoleDefaultFeatures('supervisor')).toContain('group_submission');
    expect(getRoleDefaultFeatures('committee_leader')).toContain('group_submission');
    expect(getRoleDefaultFeatures('hr')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_hr')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_caravans')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_events')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_production')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_ethics')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_quran')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_ashbal')).toContain('group_submission');
    expect(getRoleDefaultFeatures('head_marketing')).toContain('group_submission');
  });

  it('does NOT provide group_submission as default for standard volunteer', () => {
    const volunteerDefaults = getRoleDefaultFeatures('volunteer');
    expect(volunteerDefaults).not.toContain('group_submission');
    expect(volunteerDefaults.length).toBe(0);
  });

  describe('canSubmitGroupActivity', () => {
    it('returns true for leader roles even without custom features', () => {
      for (const role of GROUP_SUBMISSION_LEADER_ROLES) {
        expect(canSubmitGroupActivity(role, [])).toBe(true);
      }
    });

    it('returns false for standard volunteer without custom features', () => {
      expect(canSubmitGroupActivity('volunteer', [])).toBe(false);
      expect(canSubmitGroupActivity('volunteer', null)).toBe(false);
      expect(canSubmitGroupActivity('volunteer', undefined)).toBe(false);
    });

    it('returns true for volunteer with group_submission feature granted', () => {
      expect(canSubmitGroupActivity('volunteer', ['group_submission'])).toBe(true);
      expect(canSubmitGroupActivity('volunteer', ['other_feature', 'group_submission'])).toBe(true);
    });

    it('returns true when array of roles contains a leader role', () => {
      expect(canSubmitGroupActivity(['volunteer', 'committee_leader'], [])).toBe(true);
    });

    it('returns false when array of roles has only volunteer without features', () => {
      expect(canSubmitGroupActivity(['volunteer'], [])).toBe(false);
    });

    it('handles null/undefined gracefully', () => {
      expect(canSubmitGroupActivity(null, null)).toBe(false);
      expect(canSubmitGroupActivity(undefined, undefined)).toBe(false);
      expect(canSubmitGroupActivity(null, ['group_submission'])).toBe(true);
    });
  });
});
